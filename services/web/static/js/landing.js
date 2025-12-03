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
  const grid = document.querySelector("#mood-board-grid");
  if (!grid) return;
  grid.innerHTML = "";

  moodBoard.products.forEach((p) => {
    // Use image_url from the API, but also support imageUrl just in case
    const imgSrc = p.image_url || p.imageUrl || null;

    // Make the whole card a link
    const card = document.createElement("a");
    card.className = "rs-card";
    card.href = p.product_url || "#";
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    // Image
    const img = document.createElement("img");
    img.className = "rs-card-image";
    img.alt = p.title || "Furniture item";
    img.loading = "lazy";

    if (imgSrc) {
      img.src = imgSrc;
    } else {
      img.src = "/static/assets/no-image.svg"; // or whatever placeholder you use
    }

    // If the remote host blocks hotlinking, fall back to placeholder
    img.onerror = () => {
      console.warn("Image failed to load for", p.title, imgSrc);
      img.src = "/static/assets/no-image.svg";
    };

    // Text content
    const body = document.createElement("div");
    body.className = "rs-card-body";

    const title = document.createElement("div");
    title.className = "rs-card-title";
    title.textContent = p.title || "Untitled item";

    const meta = document.createElement("div");
    meta.className = "rs-card-meta";
    const retailer = p.retailer || "";
    const price =
      typeof p.price === "number" ? `$${p.price.toFixed(2)}` : "—";
    meta.textContent = `${retailer} • ${price}`;

    body.appendChild(title);
    body.appendChild(meta);

    card.appendChild(img);
    card.appendChild(body);

    grid.appendChild(card);
  });
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
