// static/js/landing.js

const roomForm = document.getElementById("roomForm");
const setupButton = document.getElementById("setupButton");
const statusText = document.getElementById("statusText");

const moodBoardGrid = document.getElementById("moodBoardGrid");
const moodBoardIntro = document.getElementById("moodBoardIntro");
const moodActions = document.getElementById("moodActions");
const acceptMoodBoardBtn = document.getElementById("acceptMoodBoard");
const retryMoodBoardBtn = document.getElementById("retryMoodBoard");

let currentProject = null;
let currentMoodBoard = null;

// Call backend /api/room-setup
async function callRoomSetup(roomType, roomSize, style) {
  const resp = await fetch("/api/room-setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomType, roomSize, style }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = err.error || `Error ${resp.status}`;
    throw new Error(msg);
  }
  return resp.json();
}

// Render mood board – first image from each product
function renderMoodBoard(moodBoard) {
  moodBoardGrid.innerHTML = "";
  const products = moodBoard.products || [];

  if (!products.length) {
    moodBoardIntro.textContent =
      "No matching furniture found. Try a different style.";
    moodActions.style.display = "none";
    return;
  }

  moodBoardIntro.textContent =
    "Here’s a 5-piece mood board based on your room and style. Does this feel right?";

  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "mood-card";

    const img = document.createElement("img");
    img.src = p.image_url || "";
    img.alt = p.title || "Furniture item";

    const body = document.createElement("div");
    body.className = "mood-card-body";

    const title = document.createElement("div");
    title.className = "mood-card-title";
    title.textContent = p.title || "Untitled item";

    const meta = document.createElement("div");
    meta.className = "mood-card-meta";
    const retailer = p.retailer || "unknown retailer";
    const price =
      p.price != null && !isNaN(p.price) ? `$${p.price}` : "price TBD";
    meta.textContent = `${retailer} • ${price}`;

    body.appendChild(title);
    body.appendChild(meta);
    card.appendChild(img);
    card.appendChild(body);

    moodBoardGrid.appendChild(card);
  });

  moodActions.style.display = "flex";
}

// Form submit → generate mood board
roomForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const roomType = document.getElementById("roomType").value;
  const roomSize = document.getElementById("roomSize").value;
  const style = document.getElementById("style").value;

  if (!roomType || !style) return;

  setupButton.disabled = true;
  statusText.textContent =
    "Finding furniture and building your mood board...";
  moodActions.style.display = "none";
  moodBoardGrid.innerHTML = "";

  try {
    const data = await callRoomSetup(roomType, roomSize, style);
    currentProject = data.project;
    currentMoodBoard = data.moodBoard;

    renderMoodBoard(currentMoodBoard);
    statusText.textContent = "";
  } catch (err) {
    console.error(err);
    statusText.textContent = `Error: ${err.message}`;
  } finally {
    setupButton.disabled = false;
  }
});

// "Looks good" – for now, just confirm; later you hook this into Trellis/3D
acceptMoodBoardBtn.addEventListener("click", () => {
  if (!currentProject || !currentMoodBoard) return;

  // This is where you'll move on to the Trellis / 3D viewer step.
  alert(
    "Great! Mood board accepted. Next step is to generate 3D to place in the room viewer."
  );
});

// "Try again" – same room data, different 5 products
retryMoodBoardBtn.addEventListener("click", async () => {
  if (!currentProject) return;

  const { roomType, roomSize, style } = currentProject;

  setupButton.disabled = true;
  statusText.textContent = "Refreshing mood board with new pieces...";
  moodActions.style.display = "none";
  moodBoardGrid.innerHTML = "";

  try {
    const data = await callRoomSetup(roomType, roomSize, style);
    currentProject = data.project;
    currentMoodBoard = data.moodBoard;
    renderMoodBoard(currentMoodBoard);
    statusText.textContent = "";
  } catch (err) {
    console.error(err);
    statusText.textContent = `Error: ${err.message}`;
  } finally {
    setupButton.disabled = false;
  }
});
