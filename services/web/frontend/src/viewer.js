// src/viewer.js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let scene, camera, renderer, controls;

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
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
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
  renderer.render(scene, camera);
}

function clearModels() {
  // keep first 2 children (light + axes)
  while (scene.children.length > 2) {
    scene.remove(scene.children[2]);
  }
}

export async function loadModel(rawUrl) {
  const statusEl = document.getElementById("status");
  statusEl.textContent += `\nLoading model: ${rawUrl}`;

  // strip query string so extension check works
  const urlObj = new URL(rawUrl, window.location.origin);
  const pathname = urlObj.pathname.toLowerCase();

  if (pathname.endsWith(".ply")) {
    const loader = new PLYLoader();
    loader.load(
      rawUrl,
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
        statusEl.textContent += "\nPLY model loaded.";
      },
      undefined,
      (err) => {
        console.error("PLY load error:", err);
        statusEl.textContent += `\nError loading PLY: ${err}`;
      }
    );
  } else if (pathname.endsWith(".gltf") || pathname.endsWith(".glb")) {
    const loader = new GLTFLoader();
    loader.load(
      rawUrl,
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
