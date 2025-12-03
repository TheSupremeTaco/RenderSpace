# services/web/app/routes.py
import os
import datetime
from pathlib import Path
from uuid import uuid4

import requests
from flask import (
    Blueprint,
    jsonify,
    request,
    send_from_directory,
    current_app,
)
from google.cloud import storage
from google.oauth2 import service_account

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# This file is services/web/app/routes.py
BASE_DIR = Path(__file__).resolve().parent        # .../app
STATIC_DIR = BASE_DIR / "static"                  # .../app/static

# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

bp = Blueprint("main", __name__)

# ---------------------------------------------------------------------------
# GCS / signing configuration
# ---------------------------------------------------------------------------

GCS_INPUT_BUCKET = os.environ.get("GCS_INPUT_BUCKET", "renderspace-inputs")
SIGNER_KEY_PATH = os.environ.get("URL_SIGNER_KEY_PATH")
TRELLIS_WORKER_URL = os.environ.get("TRELLIS_WORKER_URL")

storage_client = storage.Client()

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
    # Serve services/web/app/static/index.html
    return current_app.send_static_file("index.html")


@bp.route("/healthz")
def healthz():
    return "ok", 200


# SPA catch-all – any unknown path (that is not /api/…) returns index.html
@bp.route("/<path:path>")
def spa_catch_all(path: str):
    if path.startswith("api/"):
        return jsonify({"error": "Not Found"}), 404

    # If the requested file exists in static, serve it
    candidate = STATIC_DIR / path
    if candidate.is_file():
        return send_from_directory(str(STATIC_DIR), path)

    # Otherwise fall back to SPA shell
    return send_from_directory(str(STATIC_DIR), "index.html")


# ---------------------------------------------------------------------------
# Local dev upload (disk) – used when testing without GCS
# ---------------------------------------------------------------------------


@bp.route("/api/upload", methods=["POST"])
def upload_local():
    """
    Legacy/local endpoint:
    - Accepts a file via multipart/form-data (field name: "file")
    - Saves it to static/uploads
    - Returns a relative URL that the front-end can load with PLYLoader.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    uploads_dir = STATIC_DIR / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    job_id = uuid4().hex
    ext = Path(f.filename).suffix
    saved_name = f"{job_id}{ext}"
    saved_path = uploads_dir / saved_name

    f.save(saved_path)

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


@bp.route("/api/init-upload", methods=["POST"])
def init_upload():
    """
    Returns signed URLs so the browser can upload directly to GCS.

    Request JSON:
      { "filename": "table_test_gaussian.ply", "contentType": "...optional..." }
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

        upload_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=15),
            method="PUT",
            content_type=content_type,
            credentials=signing_credentials,
        )

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
        current_app.logger.exception("init-upload failed")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Start Trellis job on GPU worker
# ---------------------------------------------------------------------------


@bp.route("/api/start-job", methods=["POST"])
def start_job():
    """
    Called by the frontend after the file is uploaded to GCS.

    Request JSON:
      {
        "jobId": "...",
        "gcsPath": "gs://bucket/inputs/<jobId>/<filename>"
      }
    """
    try:
        data = request.get_json(force=True) or {}
        job_id = data.get("jobId")
        gcs_path = data.get("gcsPath")

        if not job_id or not gcs_path:
            return jsonify({"error": "jobId and gcsPath required"}), 400

        if not TRELLIS_WORKER_URL:
            current_app.logger.error("TRELLIS_WORKER_URL is not configured")
            return jsonify({"error": "TRELLIS_WORKER_URL is not configured"}), 500

        payload = {
            "job_id": job_id,
            "input_path": gcs_path,
        }

        current_app.logger.info(
            "Posting job to worker %s with payload %s",
            TRELLIS_WORKER_URL,
            payload,
        )

        resp = requests.post(TRELLIS_WORKER_URL, json=payload, timeout=30)

        try:
            worker_body = resp.json()
        except Exception:
            worker_body = resp.text

        if not resp.ok:
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

        return jsonify(
            {
                "status": "ok",
                "jobId": job_id,
                "worker": worker_body,
            }
        )

    except Exception as e:
        current_app.logger.exception("start-job failed")
        return jsonify({"error": str(e)}), 500
