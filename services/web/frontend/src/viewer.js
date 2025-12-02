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

  // Y (green) is up in Three.js by default
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.set(0, 1.5, 3);
  camera.lookAt(0, 0.5, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(light);

  const axes = new THREE.AxesHelper(1);
  scene.add(axes); // X=red, Y=green, Z=blue

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

  if (statusEl) statusEl.textContent += "\nViewer ready.";
}

function clearModels() {
  // keep the first 2 children (light + axes)
  while (scene.children.length > 2) {
    scene.remove(scene.children[2]);
  }
}

export async function loadModel(url) {
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent += `\nLoading model: ${url}`;

  const urlNoQuery = url.split("?")[0];
  const lower = urlNoQuery.toLowerCase();

  if (!lower.endsWith(".ply")) {
    if (statusEl) statusEl.textContent += "\nUnknown model extension.";
    return;
  }

  const loader = new PLYLoader();
  loader.load(
    url,
    (geometry) => {
      geometry.computeVertexNormals();

      // 1) Compute bounding box
      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox;

      const size = new THREE.Vector3();
      bbox.getSize(size);

      // 2) Center in X/Z, put base at Y=0 (floor)
      const centerX = (bbox.min.x + bbox.max.x) / 2;
      const centerZ = (bbox.min.z + bbox.max.z) / 2;

      // Move so:
      //   - X/Z centered at 0
      //   - min Y sits at 0 (on the floor)
      geometry.translate(-centerX, -bbox.min.y, -centerZ);

      // 3) Uniform scale so largest dimension ≈ 1 unit
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
}
