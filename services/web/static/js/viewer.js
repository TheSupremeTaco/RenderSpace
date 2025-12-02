/* global THREE */

const statusEl = document.getElementById("status");
const form = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");

let scene, camera, renderer, controls;

function initViewer() {
  const container = document.getElementById("viewer-container");
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight * 0.7;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.set(0, 1.5, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(light);

  // optional: axes helper to see orientation
  const axes = new THREE.AxesHelper(1);
  scene.add(axes);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function clearModels() {
  // Keep first child (light / axes), remove others starting from index 2
  while (scene.children.length > 2) {
    scene.remove(scene.children[2]);
  }
}

function loadModel(url) {
  statusEl.textContent += `\nLoading model: ${url}`;
  const lower = url.toLowerCase();

  if (lower.endsWith(".ply")) {
    const loader = new THREE.PLYLoader();
    loader.load(
      url,
      geometry => {
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ flatShading: true });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.position.set(0, 0, 0);
        mesh.scale.set(1, 1, 1);

        clearModels();
        scene.add(mesh);
        statusEl.textContent += "\nPLY model loaded.";
      },
      undefined,
      err => {
        console.error("PLY load error:", err);
        statusEl.textContent += `\nError loading PLY: ${err}`;
      }
    );
  } else if (lower.endsWith(".gltf") || lower.endsWith(".glb")) {
    const loader = new THREE.GLTFLoader();
    loader.load(
      url,
      gltf => {
        clearModels();
        scene.add(gltf.scene);
        statusEl.textContent += "\nGLTF/GLB model loaded.";
      },
      undefined,
      err => {
        console.error("GLTF/GLB load error:", err);
        statusEl.textContent += `\nError loading GLTF/GLB: ${err}`;
      }
    );
  } else {
    statusEl.textContent += "\nUnknown model extension.";
  }
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  statusEl.textContent = "Uploading...";
  const formData = new FormData();
  formData.append("file", file);

  const resp = await fetch("/api/upload", { method: "POST", body: formData });
  if (!resp.ok) {
    statusEl.textContent = "Upload failed.";
    return;
  }

  const data = await resp.json();
  statusEl.textContent = `Job: ${data.jobId}\nModel URL: ${data.modelUrl}`;
  loadModel(data.modelUrl);
});

initViewer();
