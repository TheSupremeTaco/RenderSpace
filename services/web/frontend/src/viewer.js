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

  const urlObj = new URL(rawUrl, window.location.origin);
  const pathname = urlObj.pathname.toLowerCase();

  if (pathname.endsWith(".ply")) {
    const loader = new PLYLoader();
    loader.load(
      rawUrl,
      (geometry) => {
        // ---------- center + normalize size ----------
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        // center at origin
        geometry.translate(-center.x, -center.y, -center.z);

        // scale so longest side ~1 unit
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 1.0 / maxDim;
        geometry.scale(scale, scale, scale);

        // ---------- render as point cloud, not mesh ----------
        const hasColor = geometry.getAttribute("color") !== undefined;
        const material = new THREE.PointsMaterial({
          size: 0.02,          // tweak: point size in world units
          vertexColors: hasColor,
          sizeAttenuation: true,
        });

        const points = new THREE.Points(geometry, material);

        // ---------- fix orientation (Z-up -> Y-up) ----------
        // If it’s still wrong, try Math.PI or rotate around Z instead.
        points.rotation.x = -Math.PI / 2;

        clearModels();
        scene.add(points);
        statusEl.textContent += "\nPLY point cloud loaded.";
      },
      undefined,
      (err) => {
        console.error("PLY load error:", err);
        statusEl.textContent += `\nError loading PLY: ${err}`;
      }
    );
  } else if (pathname.endsWith(".gltf") || pathname.endsWith(".glb")) {
    // keep your existing GLTF/GLB branch
  } else {
    statusEl.textContent += "\nUnknown model extension.";
  }
}