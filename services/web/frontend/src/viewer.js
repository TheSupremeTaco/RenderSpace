/* global THREE */

let scene, camera, renderer, controls;

// ---------------------------------------------------------------------------
// Initialize viewer
// ---------------------------------------------------------------------------

export function initViewer() {
  const container = document.getElementById("viewer-container");
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight * 0.7;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.set(0, 1.5, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.innerHTML = "";              // clear any previous canvas
  container.appendChild(renderer.domElement);

  // Orbit controls (THREE is on the window from the script tags)
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(light);

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
  // keep first 2 children (light + axes), remove the rest
  while (scene && scene.children.length > 2) {
    scene.remove(scene.children[2]);
  }
}

// ---------------------------------------------------------------------------
// Load a model into the scene
// ---------------------------------------------------------------------------

export function loadModel(url) {
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent += `\nLoading model: ${url}`;
  }

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

        if (statusEl) statusEl.textContent += "\nPLY model loaded.";
      },
      undefined,
      err => {
        console.error("PLY load error:", err);
        if (statusEl) statusEl.textContent += `\nError loading PLY: ${err}`;
      }
    );
  } else if (lower.endsWith(".gltf") || lower.endsWith(".glb")) {
    const loader = new THREE.GLTFLoader();
    loader.load(
      url,
      gltf => {
        clearModels();
        scene.add(gltf.scene);
        if (statusEl) statusEl.textContent += "\nGLTF/GLB model loaded.";
      },
      undefined,
      err => {
        console.error("GLTF/GLB load error:", err);
        if (statusEl) statusEl.textContent += `\nError loading GLTF/GLB: ${err}`;
      }
    );
  } else {
    if (statusEl) statusEl.textContent += "\nUnknown model extension.";
  }
}
