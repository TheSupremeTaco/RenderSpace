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

    if (!fileInput.files.length) {
      statusEl.textContent = "Select a .ply file first.";
      return;
    }

    const file = fileInput.files[0];
    const contentType =
      file.type && file.type !== "" ? file.type : "application/octet-stream";

    try {
      // 1) Ask backend for signed URLs
      statusEl.textContent = "Requesting upload URL...";

      const initResp = await fetch("/api/init-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType,
        }),
      });

      if (!initResp.ok) {
        const errText = await initResp.text();
        console.error("init-upload error:", initResp.status, errText);
        statusEl.textContent = `init-upload failed (${initResp.status}).`;
        return;
      }

      const { jobId, uploadUrl, downloadUrl, gcsPath } =
        await initResp.json();

      // 2) Upload file directly to GCS via signed URL
      statusEl.textContent = "Uploading model to cloud storage...";

      const putResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: file,
      });

      if (!putResp.ok) {
        const putText = await putResp.text().catch(() => "");
        console.error("Upload error:", putResp.status, putText);
        statusEl.textContent = `Upload failed (${putResp.status}).`;
        return;
      }

      // 3) Load the PLY from the signed download URL
      statusEl.textContent = `Upload complete (job ${jobId}). Loading model...`;

      await loadModel(downloadUrl);

      statusEl.textContent = `PLY model loaded from cloud (job ${jobId}).`;
      console.log("GCS source:", gcsPath);
    } catch (err) {
      console.error("Unexpected upload error:", err);
      statusEl.textContent = "Unexpected error during upload.";
    }
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
