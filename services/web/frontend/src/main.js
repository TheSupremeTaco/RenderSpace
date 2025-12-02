// src/main.js
import { initViewer, loadModel } from "./viewer";

function setup() {
  const fileInput = document.getElementById("file-input");
  const uploadBtn = document.getElementById("upload-btn");
  const statusEl = document.getElementById("status");

  if (!fileInput || !uploadBtn || !statusEl) {
    console.error("Missing DOM elements");
    return;
  }

  initViewer();

  async function handleUpload(event) {
    event.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
      statusEl.textContent = "Please choose a .ply file first.";
      return;
    }

    statusEl.textContent = "Initializing upload...";

    // 1) Ask backend for signed URL
    const initResp = await fetch("/api/init-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name }),
    });

    if (!initResp.ok) {
      statusEl.textContent = "init-upload failed.";
      console.error("init-upload status:", initResp.status);
      return;
    }

    const initData = await initResp.json();
    const { jobId, uploadUrl, downloadUrl, gcsPath } = initData;

    console.log("initData:", initData);
    statusEl.textContent = `Job: ${jobId}\nUploading to GCS...\n`;

    // 2) Upload file directly to GCS
    const uploadResp = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: file,
    });

    if (!uploadResp.ok) {
      statusEl.textContent += "\nUpload failed.";
      console.error("GCS upload status:", uploadResp.status);
      return;
    }

    statusEl.textContent += "Upload complete.\nStarting Trellis job...";

    // 3) Tell backend to start worker job
    const jobResp = await fetch("/api/start-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, gcsPath }),
    });

    if (!jobResp.ok) {
      statusEl.textContent += "\nTrellis job start failed.";
      console.error("start-job status:", jobResp.status);
      return;
    }

    const jobInfo = await jobResp.json();
    statusEl.textContent += `\nTrellis worker response: ${JSON.stringify(
      jobInfo
    )}`;

    // 4) Load the processed model (or original, depending on what you want)
    await loadModel(downloadUrl);
    statusEl.textContent += "\nPLY model loaded.";
  }

  uploadBtn.addEventListener("click", handleUpload);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setup);
} else {
  setup();
}
