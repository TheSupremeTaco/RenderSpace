// src/viewer.js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

let scene, camera, renderer, controls;

export function initViewer() {
  const statusEl = document.getElementById("status");
  const container = document.getElementById("viewer-container");

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight * 0.7;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.set(0, 1.5, 3);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Light + axes
  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(light);

  const axes = new THREE.AxesHelper(1);
  scene.add(axes);

  // Resize handling
  window.addEventListener("resize", () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight * 0.7;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  if (statusEl) {
    statusEl.textContent += "\nViewer ready.";
  }
}

function clearModels() {
  // Keep the first 2 children (light + axes); remove anything after that
  while (scene.children.length > 2) {
    scene.remove(scene.children[2]);
  }
}

export async function loadModel(url) {
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent += `\nLoading model: ${url}`;

  // Strip query params to check extension
  const urlNoQuery = url.split("?")[0];
  const lower = urlNoQuery.toLowerCase();

  if (lower.endsWith(".ply")) {
    const loader = new PLYLoader();
    loader.load(
      url,
      (geometry) => {
        geometry.computeVertexNormals();

        // --- Step 1: center geometry at origin ---
        geometry.computeBoundingBox();
        let bbox = geometry.boundingBox;

        const center = new THREE.Vector3();
        bbox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // --- Step 2: rotate so Z is the "up" axis ---
        // Original models are usually Y-up. Rotate -90° around X:
        geometry.rotateX(-Math.PI / 2);

        // --- Step 3: recompute bbox after rotation ---
        geometry.computeBoundingBox();
        bbox = geometry.boundingBox;

        const size = new THREE.Vector3();
        bbox.getSize(size);

        // Center in X and Y, base at Z = 0 (so it stands on the Z=0 plane)
        const centerX = (bbox.min.x + bbox.max.x) / 2;
        const centerY = (bbox.min.y + bbox.max.y) / 2;

        geometry.translate(-centerX, -centerY, -bbox.min.z);

        // --- Step 4: uniform scale so largest dimension ~ 1 unit ---
        const maxDim = Math.max(size.x, size.y, size.z) || 1.0;
        const scale = 1.0 / maxDim;

        const material = new THREE.MeshStandardMaterial({ flatShading: true });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.scale.set(scale, scale, scale);

        clearModels();
        scene.add(mesh);

        if (statusEl) statusEl.textContent += "\nPLY model loaded.";
      },
      undefined,
      (err) => {
        console.error("PLY load error:", err);
        if (statusEl) statusEl.textContent += `\nError loading PLY: ${err}`;
      }
    );
  } else {
    if (statusEl) statusEl.textContent += "\nUnknown model extension.";
  }
}
