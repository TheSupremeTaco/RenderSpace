/* global THREE */

let scene, camera, renderer, controls;
let statusEl;

// ---------------------------------------------------------------------
// Viewer setup
// ---------------------------------------------------------------------
export function initViewer() {
  statusEl = document.getElementById("status");
  const container = document.getElementById("viewer-container");

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight * 0.7;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.set(0, 1.5, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);

  // Clear anything old and attach canvas
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(light);

  // Axes helper so you can see orientation
  const axes = new THREE.AxesHelper(1);
  scene.add(axes);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function clearModels() {
  // Keep light + axes (first 2 children), remove the rest
  while (scene.children.length > 2) {
    scene.remove(scene.children[2]);
  }
}

// ---------------------------------------------------------------------
// Model loading
// ---------------------------------------------------------------------
export function loadModel(url) {
  if (!statusEl) {
    statusEl = document.getElementById("status");
  }

  statusEl.textContent += `\nLoading model: ${url}`;

  // Ignore query string when checking extension
  const urlForExt = url.split("?")[0].toLowerCase();

  if (urlForExt.endsWith(".ply")) {
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
  } else if (urlForExt.endsWith(".gltf") || urlForExt.endsWith(".glb")) {
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
    const msg =
      "\nUnknown model extension – expected .ply, .gltf or .glb (query string is fine).";
    console.warn(msg, url);
    statusEl.textContent += msg;
  }
}
