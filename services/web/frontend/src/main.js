// main.js (only the upload handler + wiring shown)

import { initViewer, loadModel } from "./viewer"; // whatever you export today

const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const statusEl = document.getElementById("status");

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
    statusEl.textContent = "Requesting upload URL...";

    // 1) Ask backend for signed URLs
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
      statusEl.textContent = `init-upload failed: ${initResp.status}`;
      console.error("init-upload error:", errText);
      return;
    }

    const { jobId, uploadUrl, downloadUrl, gcsPath } = await initResp.json();

    // 2) Upload file directly to GCS
    statusEl.textContent = "Uploading model to cloud storage...";

    const putResp = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: file,
    });

    if (!putResp.ok) {
      statusEl.textContent = `Upload failed (${putResp.status})`;
      console.error("Upload error:", putResp.status, await putResp.text());
      return;
    }

    // 3) Load the PLY from the signed download URL
    statusEl.textContent = `Upload complete. Job ${jobId}. Loading model...`;

    await loadModel(downloadUrl); // your existing viewer loader

    statusEl.textContent = `PLY model loaded from cloud. Job ${jobId}.`;
    console.log("GCS source:", gcsPath);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Unexpected error during upload.";
  }
}

initViewer(); // your existing scene setup
uploadBtn.addEventListener("click", handleUpload);
