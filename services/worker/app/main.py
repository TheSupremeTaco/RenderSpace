# services/worker/app/main.py
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ReconstructJob(BaseModel):
    input_gcs_path: str
    job_id: str
    output_ext: str = "glb"

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.post("/reconstruct")
async def reconstruct(job: ReconstructJob):
    """
    Stub implementation for now.
    Later this will:
      - download from GCS
      - run TRELLIS
      - upload GLB/PLY to GCS
    """
    return {
        "job_id": job.job_id,
        "model_gcs_path": "gs://renderspace-models/models/demo.glb",
        "model_url": "/static/models/demo.glb",  # placeholder; Cloud Run will not actually call this yet
    }
