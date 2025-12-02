// src/main.js

// If you have a global style file keep this, otherwise you can remove it.
// import "./style.css";

import { initViewer, loadModel } from "./viewer";

function setup() {
  const fileInput = document.getElementById("file-input");
  const uploadBtn = document.getElementById("upload-btn");
  const statusEl = document.getElementById("status");

  if (!fileInput || !uploadBtn || !statusEl) {
    console.error(
      "Missing DOM elements. Expected #file-input, #upload-btn, #status."
    );
    return;
  }

  initViewer(); // sets up Three.js scene and default grid, etc.

  async function handleUpload(event) {
    event.preventDefault();
    const file = fileInput.files[0];
    if (!file) {
      statusEl.textContent = "Please choose a .ply file first.";
      return;
    }
  
    statusEl.textContent = "Initializing upload...";
  
    // 1) Ask backend for signed URL + job info
    const initResp = await fetch("/api/init-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name }),
    });
  
    if (!initResp.ok) {
      statusEl.textContent = "init-upload failed.";
      return;
    }
  
    const initData = await initResp.json();
    const { job_id, upload_url, model_url, gcs_path } = initData;
  
    statusEl.textContent =
      `Job: ${job_id}\nUploading to GCS...\n`;
  
    // 2) Upload file directly to GCS via signed URL
    const uploadResp = await fetch(upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: file,
    });
  
    if (!uploadResp.ok) {
      statusEl.textContent += "\nUpload failed.";
      return;
    }
  
    statusEl.textContent += "Upload complete.\nStarting Trellis job...";
  
    // 3) Tell backend to start the worker job
    const jobResp = await fetch("/api/start-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id, gcs_path }),
    });
  
    if (!jobResp.ok) {
      statusEl.textContent += "\nTrellis job start failed.";
      return;
    }
  
    const jobInfo = await jobResp.json();
    statusEl.textContent += `\nTrellis worker response: ${JSON.stringify(jobInfo)}`;
  
    // 4) Load the uploaded PLY into the viewer (unchanged)
    await loadModel(model_url);   // your existing viewer hook
    statusEl.textContent += "\nPLY model loaded.";
  }

  uploadBtn.addEventListener("click", handleUpload);
}

// For Vite, this is usually not strictly necessary, but it’s safe
// in case the script is ever moved into <head>.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setup);
} else {
  setup();
}
