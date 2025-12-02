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

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(light);

  const axes = new THREE.AxesHelper(1);
  scene.add(axes);

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
  // keep first 2 helpers (light + axes); drop the rest
  while (scene.children.length > 2) {
    scene.remove(scene.children[2]);
  }
}

export async function loadModel(url) {
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent += `\nLoading model: ${url}`;

  // 1) Ignore query string when checking extension
  const urlNoQuery = url.split("?")[0];
  const lower = urlNoQuery.toLowerCase();

  if (lower.endsWith(".ply")) {
    const loader = new PLYLoader();
    loader.load(
      url,
      (geometry) => {
        // Ensure normals
        geometry.computeVertexNormals();

        // 2) Center and normalize size
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);

        const center = new THREE.Vector3();
        bbox.getCenter(center);

        // Move geometry so its center is at the origin
        geometry.translate(-center.x, -center.y, -center.z);

        // Uniform scale so max dimension ~ 1 unit
        const maxDim = Math.max(size.x, size.y, size.z) || 1.0;
        const scale = 1.0 / maxDim;

        const material = new THREE.MeshStandardMaterial({
          flatShading: true,
        });
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

