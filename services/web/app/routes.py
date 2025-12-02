import os
import datetime
from pathlib import Path
from uuid import uuid4

from flask import Flask, request, jsonify
from google.cloud import storage

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")

# GCS bucket for large uploads (images / big PLYs)
GCS_INPUT_BUCKET = os.environ.get("GCS_INPUT_BUCKET", "renderspace-inputs")

storage_client = storage.Client()

UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".ply"}


def allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "no file field"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "empty filename"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "only .ply files are supported"}), 400

    ext = Path(file.filename).suffix.lower()
    safe_name = f"{uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, safe_name)
    file.save(dest_path)

    model_url = f"/uploads/{safe_name}"

    return jsonify({
        "jobId": safe_name,
        "modelUrl": model_url,
    })

@app.route("/api/init-upload", methods=["POST"])
def init_upload():
    """
    Returns a signed URL so the browser can PUT the file directly to GCS.
    Also returns a signed GET URL we can use to load the PLY later.
    Body: { "filename": "...", "contentType": "..." }
    """
    data = request.get_json(force=True)
    filename = data.get("filename")
    if not filename:
        return jsonify({"error": "filename required"}), 400

    content_type = data.get("contentType") or "application/octet-stream"

    job_id = uuid4().hex
    object_name = f"inputs/{job_id}/{filename}"

    bucket = storage_client.bucket(GCS_INPUT_BUCKET)
    blob = bucket.blob(object_name)

    # Signed URL for PUT (upload)
    upload_url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(minutes=15),
        method="PUT",
        content_type=content_type,
    )

    # Signed URL for GET (download / viewer)
    download_url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(hours=1),
        method="GET",
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


@app.route("/healthz")
def healthz():
    return "ok", 200
