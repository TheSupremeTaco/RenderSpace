# worker/app/main.py (FastAPI)
from fastapi import FastAPI
from pydantic import BaseModel
from uuid import uuid4
from pathlib import Path
import shutil
import os

app = FastAPI()

INPUT_DIR = Path("/opt/trellis_samples")
OUTPUT_DIR = Path("/opt/trellis_outputs")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class JobRequest(BaseModel):
    job_id: str | None = None
    input_path: str   # e.g. "gs://renderspace-inputs/inputs/<jobId>/couch_test_gaussian.ply"

@app.get("/healthz")
def health():
    return {"status": "ok"}

@app.post("/jobs")
def start_job(req: JobRequest):
    job_id = req.job_id or uuid4().hex

    # For now: stub – copy a local sample PLY into OUTPUT_DIR
    sample = INPUT_DIR / "couch_test_gaussian.ply"   # make sure this exists
    out_path = OUTPUT_DIR / f"{job_id}_couch_test_gaussian.ply"
    shutil.copy2(sample, out_path)

    # In the real version you’d:
    #  1) download req.input_path from GCS → local
    #  2) run Trellis
    #  3) upload result back to GCS

    return {
        "job_id": job_id,
        "status": "completed",
        "local_output_path": str(out_path),
        "message": "Stub Trellis job ran successfully",
    }
