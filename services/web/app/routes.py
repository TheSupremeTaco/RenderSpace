import os
import datetime
from pathlib import Path
from uuid import uuid4

import requests
from flask import Flask, jsonify, request, send_from_directory
from google.cloud import storage
from google.oauth2 import service_account

# ---------------------------------------------------------------------------
# Paths / Flask app
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = BASE_DIR / "static"

app = Flask(
    __name__,
    static_folder=str(STATIC_DIR),
    static_url_path="",  # static files served from root (/assets, /uploads, etc.)
)

# ---------------------------------------------------------------------------
# GCS / signing configuration
# ---------------------------------------------------------------------------

# GCS bucket where uploads should go
GCS_INPUT_BUCKET = os.environ.get("GCS_INPUT_BUCKET", "renderspace-inputs")

# Path to JSON key file for the signer service account.
# In Cloud Run this should be something like: /secrets/url-signer-key.json
SIGNER_KEY_PATH = os.environ.get("URL_SIGNER_KEY_PATH")

# URL of the GPU worker FastAPI /jobs endpoint, for example:
#   TRELLIS_WORKER_URL="http://34.125.83.54:8000/jobs"
TRELLIS_WORKER_URL = os.environ.get("TRELLIS_WORKER_URL")

# Client for normal Storage operations (uses Cloud Run service account)
storage_client = storage.Client()

# Credentials used only for signing URLs (separate service account key)
signing_credentials = None
if SIGNER_KEY_PATH and os.path.exists(SIGNER_KEY_PATH):
    signing_credentials = service_account.Credentials.from_service_account_file(
        SIGNER_KEY_PATH
    )

# ---------------------------------------------------------------------------
# Frontend routes
# ---------------------------------------------------------------------------


@bp.route("/")
def index():
    # Serve the static landing page: services/web/app/static/index.html
    return current_app.send_static_file("index.html")


@app.route("/healthz")
def healthz():
    return "ok", 200


# SPA catch-all – any unknown path (that is not /api/…) returns index.html
@app.route("/<path:path>")
def spa_catch_all(path: str):
    if path.startswith("api/"):
        return jsonify({"error": "Not Found"}), 404

    # If the requested file exists in static, serve it
    candidate = STATIC_DIR / path
    if candidate.is_file():
        return send_from_directory(STATIC_DIR, path)

    # Otherwise fall back to SPA shell
    return send_from_directory(STATIC_DIR, "index.html")


# ---------------------------------------------------------------------------
# Local dev upload (disk) – used when testing without GCS
# ---------------------------------------------------------------------------


@app.route("/api/upload", methods=["POST"])
def upload_local():
    """
    Legacy/local endpoint:
    - Accepts a file via multipart/form-data (field name: "file")
    - Saves it to static/uploads
    - Returns a relative URL that the front-end can load with PLYLoader.

    This is fine for local docker testing and small files, but in Cloud Run we
    should prefer /api/init-upload + direct GCS upload for large assets.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    uploads_dir = STATIC_DIR / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    job_id = uuid4().hex
    # Preserve extension; filename itself is not used for anything else
    ext = Path(f.filename).suffix
    saved_name = f"{job_id}{ext}"
    saved_path = uploads_dir / saved_name

    f.save(saved_path)

    # static_url_path="" means /uploads/... maps to STATIC_DIR/uploads/...
    model_url = f"/uploads/{saved_name}"

    return jsonify(
        {
            "jobId": job_id,
            "modelUrl": model_url,
        }
    )


# ---------------------------------------------------------------------------
# GCS signed-URL upload – production path for large files
# ---------------------------------------------------------------------------


@app.route("/api/init-upload", methods=["POST"])
def init_upload():
    """
    Returns signed URLs so the browser can upload directly to GCS.

    Request JSON:
      { "filename": "table_test_gaussian.ply", "contentType": "...optional..." }

    Response JSON:
      {
        "jobId": "...",
        "uploadUrl": "...signed PUT...",
        "downloadUrl": "...signed GET...",
        "gcsPath": "gs://bucket/inputs/<jobId>/<filename>"
      }
    """
    try:
        data = request.get_json(force=True) or {}
        filename = data.get("filename")
        if not filename:
            return jsonify({"error": "filename required"}), 400

        content_type = data.get("contentType") or "application/octet-stream"

        if signing_credentials is None:
            return jsonify({"error": "signing credentials not loaded"}), 500

        job_id = uuid4().hex
        object_name = f"inputs/{job_id}/{filename}"

        bucket = storage_client.bucket(GCS_INPUT_BUCKET)
        blob = bucket.blob(object_name)

        # Signed URL for PUT (upload from browser → GCS)
        upload_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=15),
            method="PUT",
            content_type=content_type,
            credentials=signing_credentials,
        )

        # Signed URL for GET (viewer loads the PLY)
        download_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(hours=1),
            method="GET",
            credentials=signing_credentials,
        )

        gcs_path = f"gs://{GCS_INPUT_BUCKET}/{object_name}"

        return jsonify(
            {
                "jobId": job_id,
                "uploadUrl": upload_url,
                "downloadUrl": download_url,
                "gcsPath": gcs_path,
            }
        )
    except Exception as e:
        app.logger.exception("init-upload failed")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Start Trellis job on GPU worker
# ---------------------------------------------------------------------------


@app.route("/api/start-job", methods=["POST"])
def start_job():
    """
    Called by the frontend after the file is uploaded to GCS.

    Request JSON:
      {
        "jobId": "...",
        "gcsPath": "gs://bucket/inputs/<jobId>/<filename>"
      }

    This method forwards the request to the GPU worker's /jobs endpoint.
    """
    try:
        data = request.get_json(force=True) or {}
        job_id = data.get("jobId")
        gcs_path = data.get("gcsPath")

        if not job_id or not gcs_path:
            return jsonify({"error": "jobId and gcsPath required"}), 400

        if not TRELLIS_WORKER_URL:
            app.logger.error("TRELLIS_WORKER_URL is not configured")
            return jsonify({"error": "TRELLIS_WORKER_URL is not configured"}), 500

        # Payload expected by the FastAPI worker
        payload = {
            "job_id": job_id,
            "input_path": gcs_path,  # worker will later download from this GCS path
        }

        app.logger.info(
            "Posting job to worker %s with payload %s",
            TRELLIS_WORKER_URL,
            payload,
        )

        resp = requests.post(TRELLIS_WORKER_URL, json=payload, timeout=30)

        # Try to decode JSON either way, so we can surface worker errors
        try:
            worker_body = resp.json()
        except Exception:
            worker_body = resp.text

        if not resp.ok:
            # Surface as 502 so frontend can see real worker error
            return (
                jsonify(
                    {
                        "error": "Worker call failed",
                        "worker_status": resp.status_code,
                        "worker_body": worker_body,
                    }
                ),
                502,
            )

        # Happy path
        return jsonify(
            {
                "status": "ok",
                "jobId": job_id,
                "worker": worker_body,
            }
        )

    except Exception as e:
        app.logger.exception("start-job failed")
        return jsonify({"error": str(e)}), 500
