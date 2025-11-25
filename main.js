import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

// ---------- Basic scene ----------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);
// Start a bit zoomed out, looking at the living room
camera.position.set(0, 4, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 2.5); // aim at living room center
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Clamp zoom range
controls.minDistance = 2;
controls.maxDistance = 30;
controls.update();

// ---------- Zoom buttons ----------

const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const zoomOffset = new THREE.Vector3();
const ZOOM_FACTOR = 0.8; // <1 = zoom in, >1 = zoom out

function applyZoom(factor) {
  zoomOffset.subVectors(camera.position, controls.target);
  let distance = zoomOffset.length();

  distance *= factor;
  distance = Math.min(Math.max(distance, controls.minDistance), controls.maxDistance);

  zoomOffset.setLength(distance);
  camera.position.copy(controls.target).add(zoomOffset);
  controls.update();
}

zoomInBtn.addEventListener("click", () => applyZoom(ZOOM_FACTOR));
zoomOutBtn.addEventListener("click", () => applyZoom(1 / ZOOM_FACTOR));

// ---------- Lights ----------

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
hemiLight.position.set(0, 1, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(3, 5, 2);
scene.add(dirLight);

// Helpers (can comment out later)
const grid = new THREE.GridHelper(20, 20);
grid.position.y = 0.001;
scene.add(grid);

const axes = new THREE.AxesHelper(2); // X=red, Y=green, Z=blue
scene.add(axes);

// ---------- Square 1BR / 1BA layout ----------
// Overall square: 9 x 9 units.
// Three rooms stacked along Z: each 3 x 3.
//  - Front (z=+3): living room, with entrance in front wall.
//  - Middle (z=0): bedroom, doorway from living.
//  - Back (z=-3): bathroom, doorway from bedroom.

const floorY = 0;
const roomSize = 3;
const apartmentSize = 9;
const wallHeight = 2.5;
const wallThickness = 0.05;

function makeFloor(width, depth, color, x, z) {
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshPhongMaterial({ color, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, floorY, z);
  scene.add(mesh);
  return mesh;
}

function makeWallHorizontal(length, x, z, color = 0x888888) {
  const geo = new THREE.BoxGeometry(length, wallHeight, wallThickness);
  const mat = new THREE.MeshPhongMaterial({ color });
  const wall = new THREE.Mesh(geo, mat);
  wall.position.set(x, wallHeight / 2, z);
  scene.add(wall);
  return wall;
}

function makeWallVertical(length, x, z, color = 0x888888) {
  const geo = new THREE.BoxGeometry(wallThickness, wallHeight, length);
  const mat = new THREE.MeshPhongMaterial({ color });
  const wall = new THREE.Mesh(geo, mat);
  wall.position.set(x, wallHeight / 2, z);
  scene.add(wall);
  return wall;
}

// Room centers (x=0, stacked along Z)
const livingCenterZ  =  roomSize;   // +3
const bedroomCenterZ =  0;
const bathCenterZ    = -roomSize;   // -3

// Floors
makeFloor(roomSize, roomSize, 0x3c3c3c, 0, livingCenterZ);   // living
makeFloor(roomSize, roomSize, 0x2f2f2f, 0, bedroomCenterZ);  // bedroom
makeFloor(roomSize, roomSize, 0x262626, 0, bathCenterZ);     // bath

// Outer square bounds
const half = apartmentSize / 2; // 4.5
const minX = -half;
const maxX =  half;
const minZ = -half;
const maxZ =  half;

// ---- Outer walls, with an entrance gap in front wall (living room) ----

const doorWidth = 1.2;
const entranceCenterX = 0;

// Front wall (z = maxZ), split into left + right segments around entrance
const frontLeftLen  = (maxX - minX - doorWidth) / 2;
const frontRightLen = frontLeftLen;

makeWallHorizontal(
  frontLeftLen,
  minX + frontLeftLen / 2,
  maxZ + wallThickness / 2
);
makeWallHorizontal(
  frontRightLen,
  maxX - frontRightLen / 2,
  maxZ + wallThickness / 2
);

// Back wall (no door)
makeWallHorizontal(
  maxX - minX,
  (minX + maxX) / 2,
  minZ - wallThickness / 2
);

// Side walls (no doors)
makeWallVertical(
  maxZ - minZ,
  minX - wallThickness / 2,
  (minZ + maxZ) / 2
);
makeWallVertical(
  maxZ - minZ,
  maxX + wallThickness / 2,
  (minZ + maxZ) / 2
);

// ---- Interior walls between rooms, with doorways ----

// Wall between living and bedroom (z boundary = +1.5)
const boundary1Z = livingCenterZ - roomSize / 2; // +1.5
const interiorDoorWidth = 1.0;

// Break into top/bottom segments to leave a doorway at x=0
const spanX = roomSize; // room is 3 units wide
const halfSpanX = spanX / 2;
const segLen = (spanX - interiorDoorWidth) / 2;

// upper segment (positive X)
makeWallHorizontal(
  segLen,
  segLen / 2,
  boundary1Z
);
// lower segment (negative X)
makeWallHorizontal(
  segLen,
  -segLen / 2,
  boundary1Z
);

// Wall between bedroom and bath (z boundary = -1.5)
const boundary2Z = bathCenterZ + roomSize / 2; // -1.5

makeWallHorizontal(
  segLen,
  segLen / 2,
  boundary2Z
);
makeWallHorizontal(
  segLen,
  -segLen / 2,
  boundary2Z
);

// ---------- TRELLIS furniture in living room ----------

const loader = new PLYLoader();

// Place furniture initially in living room (z ≈ +3)
const furnitureFiles = [
  // Sectional along back wall of living room
  { path: "models/couch_test_gaussian.ply",   pos: new THREE.Vector3(0,      0, livingCenterZ - 1.0) },
  // Lounge chair near right side
  { path: "models/lounge_test_gaussian.ply",  pos: new THREE.Vector3(+1.0,  0, livingCenterZ - 0.2) },
  // Ottoman in the center
  { path: "models/ottoman_test_gaussian.ply", pos: new THREE.Vector3(0.0,   0, livingCenterZ) },
  // Coffee table between couch and ottoman
  { path: "models/table_test_gaussian.ply",   pos: new THREE.Vector3(0.0,   0, livingCenterZ - 0.6) },
];

const draggableObjects = [];

function loadFurniture({ path, pos }) {
  loader.load(
    path,
    (geometry) => {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const size = new THREE.Vector3();
      box.getSize(size);

      const maxDim = Math.max(size.x, size.y, size.z);
      const targetSize = 1.0;
      const scale = maxDim > 0 ? targetSize / maxDim : 1.0;

      // center + scale
      geometry.translate(
        -(box.min.x + box.max.x) / 2,
        -(box.min.y + box.max.y) / 2,
        -(box.min.z + box.max.z) / 2
      );
      geometry.scale(scale, scale, scale);

      // upright & facing -Z
      geometry.rotateX(Math.PI);
      geometry.rotateY(-Math.PI / 2);

      // height-based colors
      const position = geometry.getAttribute("position");
      const count = position.count;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < count; i++) {
        const y = position.getY(i);
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const rangeY = maxY - minY || 1.0;

      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const y = position.getY(i);
        const t = (y - minY) / rangeY;

        const r = 1.0;
        const g = 0.5 + 0.5 * t;
        const b = 0.2 + 0.8 * (1.0 - t);

        colors[3 * i + 0] = r;
        colors[3 * i + 1] = g;
        colors[3 * i + 2] = b;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.01,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
      });

      const points = new THREE.Points(geometry, material);
      points.position.copy(pos);
      points.position.y = floorY + 0.3;

      points.userData.draggable = true;
      draggableObjects.push(points);
      scene.add(points);
    },
    undefined,
    (error) => console.error(`Error loading ${path}:`, error)
  );
}

furnitureFiles.forEach(loadFurniture);

// ---------- Drag interaction ----------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const planeIntersectPoint = new THREE.Vector3();
const dragOffset = new THREE.Vector3();

let selectedObject = null;
let isDragging = false;

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function onPointerDown(event) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(draggableObjects);

  if (intersects.length > 0) {
    selectedObject = intersects[0].object;
    isDragging = true;

    dragPlane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      selectedObject.position
    );

    raycaster.ray.intersectPlane(dragPlane, planeIntersectPoint);
    dragOffset.copy(selectedObject.position).sub(planeIntersectPoint);

    controls.enabled = false;
  }
}

function onPointerMove(event) {
  if (!isDragging || !selectedObject) return;

  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);

  if (raycaster.ray.intersectPlane(dragPlane, planeIntersectPoint)) {
    const newPos = planeIntersectPoint.clone().add(dragOffset);
    selectedObject.position.set(newPos.x, floorY + 0.3, newPos.z);
  }
}

function onPointerUp() {
  if (isDragging) {
    isDragging = false;
    selectedObject = null;
    controls.enabled = true;
  }
}

renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("pointerup", onPointerUp);
renderer.domElement.addEventListener("pointerleave", onPointerUp);

// ---------- Resize + render loop ----------

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
