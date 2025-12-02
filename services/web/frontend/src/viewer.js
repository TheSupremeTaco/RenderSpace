// src/viewer.js
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let scene, camera, renderer, controls;

/**
 * Initialise the Three.js viewer.
 * Called once from src/main.js.
 */
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
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(light);

  const axes = new THREE.AxesHelper(1);
  scene.add(axes);

  window.addEventListener("resize", onWindowResize);

  animate();
}

function onWindowResize() {
  if (!renderer || !camera) return;

  const container = document.getElementById("viewer-container");
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight * 0.7;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Remove previously loaded models, but keep lights / helpers.
 */
function clearModels() {
  // keep first two children (light + axes)
  while (scene.children.length > 2) {
    scene.remove(scene.children[2]);
  }
}

/**
 * Load a model URL (PLY or GLTF/GLB) into the scene.
 * Returns a Promise that resolves when the model is loaded.
 */
export function loadModel(url) {
  const lower = url.toLowerCase();

  return new Promise((resolve, reject) => {
    if (lower.endsWith(".ply")) {
      const loader = new PLYLoader();
      loader.load(
        url,
        (geometry) => {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({ flatShading: true });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          mesh.position.set(0, 0, 0);
          mesh.scale.set(1, 1, 1);

          clearModels();
          scene.add(mesh);
          resolve(mesh);
        },
        undefined,
        (err) => {
          console.error("PLY load error:", err);
          reject(err);
        }
      );
    } else if (lower.endsWith(".gltf") || lower.endsWith(".glb")) {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          clearModels();
          scene.add(gltf.scene);
          resolve(gltf.scene);
        },
        undefined,
        (err) => {
          console.error("GLTF/GLB load error:", err);
          reject(err);
        }
      );
    } else {
      const err = new Error("Unknown model extension: " + url);
      console.error(err);
      reject(err);
    }
  });
}
