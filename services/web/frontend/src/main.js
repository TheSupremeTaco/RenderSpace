import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

const statusEl = document.getElementById("status");
const form = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");

let scene, camera, renderer, controls;

function initViewer() {
  const container = document.getElementById("viewer-container");
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight * 0.7;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
  camera.position.set(0, 4, 12);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 2.5);
  controls.enableDamping = true;
  controls.minDistance = 2;
  controls.maxDistance = 30;
  controls.update();

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
  hemiLight.position.set(0, 1, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(3, 5, 2);
  scene.add(dirLight);

  const grid = new THREE.GridHelper(20, 20);
  grid.position.y = 0.001;
  scene.add(grid);

  const axes = new THREE.AxesHelper(2);
  scene.add(axes);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function clearModels() {
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const child = scene.children[i];
    if (child.isMesh || child.isPoints) {
      scene.remove(child);
    }
  }
}

function loadPlyModel(url) {
  statusEl.textContent += `\nLoading model: ${url}`;
  const loader = new PLYLoader();

  loader.load(
    url,
    (geometry) => {
      const position = geometry.getAttribute("position");
      if (!position || position.count === 0) {
        statusEl.textContent += "\nNo vertices in loaded PLY.";
        console.warn("position attribute:", position);
        return;
      }

      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const size = new THREE.Vector3();
      box.getSize(size);

      const maxDim = Math.max(size.x, size.y, size.z);
      const targetSize = 1.0;
      const scale = maxDim > 0 ? targetSize / maxDim : 1.0;

      // center + scale
      geometry.translate(
        -(box.min.x + box.max.x) / 2,
        -(box.min.y + box.max.y) / 2,
        -(box.min.z + box.max.z) / 2,
      );
      geometry.scale(scale, scale, scale);

      // upright and facing -Z, as in your old code
      geometry.rotateX(Math.PI);
      geometry.rotateY(-Math.PI / 2);

      const count = position.count;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < count; i++) {
        const y = position.getY(i);
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const rangeY = maxY - minY || 1.0;

      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const y = position.getY(i);
        const t = (y - minY) / rangeY;
        const r = 1.0;
        const g = 0.5 + 0.5 * t;
        const b = 0.2 + 0.8 * (1.0 - t);
        colors[3 * i + 0] = r;
        colors[3 * i + 1] = g;
        colors[3 * i + 2] = b;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.01,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
      });

      const points = new THREE.Points(geometry, material);
      points.position.set(0, 0.3, 0);

      clearModels();
      scene.add(points);

      statusEl.textContent += "\nPLY model loaded.";
    },
    undefined,
    (err) => {
      console.error("PLY load error:", err);
      statusEl.textContent += `\nError loading PLY: ${err}`;
    },
  );
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  try {
    statusEl.textContent = "Initializing upload...";

    // 1) Ask backend for signed URLs
    const initResp = await fetch("/api/init-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      }),
    });

    if (!initResp.ok) {
      statusEl.textContent = "Failed to init upload.";
      console.error("init-upload failed", initResp.status, await initResp.text());
      return;
    }

    const initData = await initResp.json();
    const { jobId, uploadUrl, downloadUrl, gcsPath } = initData;

    // 2) Upload file directly to GCS via signed PUT URL
    statusEl.textContent = `Uploading to GCS...\nJob: ${jobId}`;
    const putResp = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!putResp.ok) {
      statusEl.textContent = "Upload to GCS failed.";
      console.error("GCS upload error", putResp.status, await putResp.text());
      return;
    }

    statusEl.textContent =
      `Upload complete.\nJob: ${jobId}\nGCS path: ${gcsPath}\nModel URL: ${downloadUrl}`;

    // 3) For now, our "model" is just the uploaded PLY itself
    loadPlyModel(downloadUrl);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Unexpected error during upload.";
  }
});


initViewer();
