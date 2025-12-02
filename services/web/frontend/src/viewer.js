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

  // Axes: X = red, Y = green (UP), Z = blue
  const axes = new THREE.AxesHelper(1.0);
  scene.add(axes);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function clearModels() {
  // Keep first children (light + axes), remove others starting from index 2
  while (scene.children.length > 2) {
    scene.remove(scene.children[2]);
  }
}

function normalizeAndCenterGeometry(geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;

  const size = new THREE.Vector3();
  box.getSize(size);
  const maxSize = Math.max(size.x, size.y, size.z) || 1.0;

  // Scale to unit size
  const scale = 1.0 / maxSize;
  geometry.scale(scale, scale, scale);

  // Recompute bbox after scaling, then center
  geometry.computeBoundingBox();
  const newBox = geometry.boundingBox;
  const center = new THREE.Vector3();
  newBox.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);
}

function loadModel(url) {
  statusEl.textContent += `\nLoading model: ${url}`;
  const lower = url.toLowerCase();

  if (lower.endsWith(".ply")) {
    const loader = new THREE.PLYLoader();
    loader.load(
      url,
      (geometry) => {
        geometry.computeVertexNormals();
        normalizeAndCenterGeometry(geometry);

        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          flatShading: true,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // ORIENTATION FIX:
        // Trellis / your PLY outputs seem to have "up" != Y.
        // Rotate -90° around X so the furniture is vertical along the green Y axis.
        mesh.rotation.x = -Math.PI / 2;
        // If that flips it the wrong way, use +Math.PI / 2 instead.

        clearModels();
        scene.add(mesh);
        statusEl.textContent += "\nPLY model loaded.";
      },
      undefined,
      (err) => {
        console.error("PLY load error:", err);
        statusEl.textContent += `\nError loading PLY: ${err}`;
      }
    );
  } else if (lower.endsWith(".gltf") || lower.endsWith(".glb")) {
    const loader = new THREE.GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        clearModels();
        scene.add(gltf.scene);
        statusEl.textContent += "\nGLTF/GLB model loaded.";
      },
      undefined,
      (err) => {
        console.error("GLTF/GLB load error:", err);
        statusEl.textContent += `\nError loading GLTF/GLB: ${err}`;
      }
    );
  } else {
    statusEl.textContent += "\nUnknown model extension.";
  }
}

form.addEventListener("submit", async (e) => {
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
