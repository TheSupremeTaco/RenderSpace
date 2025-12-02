import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from google.cloud import storage
from google.oauth2 import service_account

app = FastAPI(title="RenderSpace TRELLIS Worker")

# ---------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------

GCS_INPUT_BUCKET = os.environ.get("GCS_INPUT_BUCKET", "renderspace-inputs")
GCS_MODELS_BUCKET = os.environ.get("GCS_MODELS_BUCKET", "renderspace-models")

# Optional signer key (JSON) for signed URLs.
# If not set, we will just return the gs:// path (or public_url).
SIGNER_KEY_PATH = os.environ.get("URL_SIGNER_KEY_PATH")

storage_client = storage.Client()

signing_credentials = None
if SIGNER_KEY_PATH and os.path.exists(SIGNER_KEY_PATH):
    signing_credentials = service_account.Credentials.from_service_account_file(
        SIGNER_KEY_PATH
    )


# ---------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------

class ReconstructRequest(BaseModel):
    job_id: str
    input_gcs_path: str  # e.g. gs://renderspace-inputs/inputs/<job>/<file>.png


class ReconstructResponse(BaseModel):
    job_id: str
    input_gcs_path: str
    output_gcs_path: str
    model_url: str  # signed URL or public URL


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

def parse_gcs_path(uri: str) -> tuple[str, str]:
    if not uri.startswith("gs://"):
        raise ValueError(f"Invalid GCS path: {uri}")
    _, rest = uri.split("gs://", 1)
    parts = rest.split("/", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid GCS path: {uri}")
    return parts[0], parts[1]


def run_trellis(input_path: Path, output_path: Path) -> None:
    """
    Placeholder for the actual TRELLIS invocation.

    Replace this with the real call, e.g.:
      subprocess.run([...], check=True)

    For now, just copy the input or write a dummy PLY so the pipeline works.
    """
    # Example: copy input to output (if you're already starting from a PLY)
    # shutil.copy2(input_path, output_path)

    # or create a tiny dummy PLY:
    output_path.write_text(
        "ply\nformat ascii 1.0\n"
        "element vertex 1\n"
        "property float x\nproperty float y\nproperty float z\n"
        "end_header\n"
        "0 0 0\n"
    )


def upload_and_optionally_sign(
    local_path: Path,
    bucket_name: str,
    object_name: str,
) -> tuple[str, str]:
    """
    Uploads local_path to gs://bucket/object_name and optionally returns a
    signed URL. If signing credentials are not configured, returns public_url.
    """
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(object_name)
    blob.upload_from_filename(str(local_path))

    gcs_uri = f"gs://{bucket_name}/{object_name}"

    if signing_credentials is not None:
        url = blob.generate_signed_url(
            version="v4",
            expiration=3600,  # 1 hour
            method="GET",
            credentials=signing_credentials,
        )
    else:
        # This will only be directly usable if the object/bucket is public.
        url = blob.public_url

    return gcs_uri, url


# ---------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------

@app.post("/reconstruct", response_model=ReconstructResponse)
async def reconstruct(req: ReconstructRequest):
    try:
        in_bucket, in_object = parse_gcs_path(req.input_gcs_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if in_bucket != GCS_INPUT_BUCKET:
        raise HTTPException(
            status_code=400,
            detail=f"Unexpected bucket {in_bucket}, expected {GCS_INPUT_BUCKET}",
        )

    # Download input to a temp path
    tmp_dir = Path(tempfile.mkdtemp(prefix="trellis-"))
    input_path = tmp_dir / "input"
    output_path = tmp_dir / "model.ply"

    try:
        input_blob = storage_client.bucket(in_bucket).blob(in_object)
        input_blob.download_to_filename(str(input_path))

        # Run TRELLIS (replace stub with real call)
        run_trellis(input_path, output_path)

        # Upload output model to models bucket
        output_object = f"models/{req.job_id}/model.ply"
        output_gcs_path, model_url = upload_and_optionally_sign(
            output_path, GCS_MODELS_BUCKET, output_object
        )

        return ReconstructResponse(
            job_id=req.job_id,
            input_gcs_path=req.input_gcs_path,
            output_gcs_path=output_gcs_path,
            model_url=model_url,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Best-effort cleanup
        try:
            for p in tmp_dir.iterdir():
                p.unlink()
            tmp_dir.rmdir()
        except Exception:
            pass