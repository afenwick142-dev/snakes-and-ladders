// game.js
// Full game logic for Snakes & Ladders
// - Uses Render backend API
// - Shows logged-in user in header
// - Handles rolls, movement, board animation, sounds & confetti

const API = "https://snakes-ladders-backend-github.onrender.com";

// -----------------------------------------------------------------------------
// ELEMENT REFERENCES
// -----------------------------------------------------------------------------
const userInfoEl = document.getElementById("userInfo");
const logoutBtn = document.getElementById("btnLogout");

const boardGridEl = document.getElementById("boardGrid");
const counterEl = document.getElementById("counter");

const diceEl = document.getElementById("dice");
const rollBtn = document.getElementById("btnRoll");

const statusPosition = document.getElementById("statusPosition");
const statusRollsUsed = document.getElementById("statusRollsUsed");
const statusRollsGranted = document.getElementById("statusRollsGranted");
const statusReward = document.getElementById("statusReward");

const statusPositionText = document.getElementById("statusPositionText");
const statusRollsUsedText = document.getElementById("statusRollsUsedText");
const statusRollsGrantedText = document.getElementById("statusRollsGrantedText");
const statusRewardText = document.getElementById("statusRewardText");
const statusCaption = document.getElementById("statusCaption");

const winOverlay = document.getElementById("winOverlay");
const winMessage = document.getElementById("winMessage");
const winCloseBtn = document.getElementById("winCloseBtn");

const counterChoiceButtons = document.querySelectorAll(".counter-choice");

// Sounds
const moveSound = new Audio("move.mp3");
const snakeSound = new Audio("snake.mp3");
const ladderSound = new Audio("ladder.mp3");
const winSound = new Audio("win.mp3");
const diceSound = new Audio("dice.mp3");

// -----------------------------------------------------------------------------
// PLAYER CONTEXT (LOCAL STORAGE)
// -----------------------------------------------------------------------------
let email = localStorage.getItem("playerEmail");
let area = localStorage.getItem("playerArea");

if (!email || !area) {
  // No player in storage, send back to login
  window.location.href = "index.html";
}

// Fill header pill
if (userInfoEl) {
  userInfoEl.textContent = `${email} · ${area}`;
  userInfoEl.title = `${email} (${area})`;
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("playerEmail");
    localStorage.removeItem("playerArea");
    window.location.href = "index.html";
  });
}

// -----------------------------------------------------------------------------
// BOARD SETUP
// -----------------------------------------------------------------------------
const ROWS = 5;
const COLS = 6;
const FINAL_SQUARE = 30;

// Map of position (1–30) -> cell element
const cellsByPosition = {};

// Build invisible grid cells that overlay the board image
function buildBoardGrid() {
  if (!boardGridEl) return;

  boardGridEl.innerHTML = "";
  const allCells = [];

  for (let i = 0; i < FINAL_SQUARE; i++) {
    const cell = document.createElement("div");
    cell.className = "board-cell";
    boardGridEl.appendChild(cell);
    allCells.push(cell);
  }

  // We want:
  // Bottom row (row index 4): 1–6 left->right
  // Row 3 from bottom (row index 3): 7–12 right->left
  // Row 2 from bottom (row index 2): 13–18 left->right
  // Row 1 from bottom (row index 1): 19–24 right->left
  // Top row (row index 0): 25–30 left->right
  let pos = 1;
  for (let visualRowFromBottom = 0; visualRowFromBottom < ROWS; visualRowFromBottom++) {
    const realRowIndex = ROWS - 1 - visualRowFromBottom; // convert bottom-up to top-down
    const rowCells = [];
    for (let col = 0; col < COLS; col++) {
      const index = realRowIndex * COLS + col;
      rowCells.push(allCells[index]);
    }
    // Every second row (1, 3, ...) from bottom should be reversed (right->left)
    if (visualRowFromBottom % 2 === 1) {
      rowCells.reverse();
    }
    for (const cell of rowCells) {
      cellsByPosition[pos] = cell;
      cell.dataset.position = String(pos);
      pos++;
    }
  }
}

// Place counter on a specific board position
function placeCounter(position) {
  if (!counterEl || !boardGridEl) return;
  if (position < 1 || position > FINAL_SQUARE) {
    counterEl.classList.add("hidden");
    return;
  }

  const cell = cellsByPosition[position];
  if (!cell) {
    counterEl.classList.add("hidden");
    return;
  }

  counterEl.classList.remove("hidden");

  const gridRect = boardGridEl.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();

  const centerX = cellRect.left + cellRect.width / 2 - gridRect.left;
  const centerY = cellRect.top + cellRect.height / 2 - gridRect.top;

  counterEl.style.transform = `translate(${centerX}px, ${centerY}px) translate(-50%, -50%)`;
}

// -----------------------------------------------------------------------------
// STATE
// -----------------------------------------------------------------------------
let currentPosition = 0;
let rollsUsed = 0;
let rollsGranted = 0;
let currentReward = null;
let gameCompleted = false;
let isAnimating = false;

// Update all status UI text
function updateStatusUI() {
  const remaining = Math.max(0, rollsGranted - rollsUsed);

  if (statusPosition) statusPosition.textContent = String(currentPosition);
  if (statusRollsUsed) statusRollsUsed.textContent = String(rollsUsed);
  if (statusRollsGranted) statusRollsGranted.textContent = String(rollsGranted);
  if (statusReward) statusReward.textContent = currentReward ? `£${currentReward}` : "—";

  if (statusPositionText)
    statusPositionText.textContent = `Position: ${currentPosition} / ${FINAL_SQUARE}`;
  if (statusRollsUsedText)
    statusRollsUsedText.textContent = `Rolls used: ${rollsUsed}`;
  if (statusRollsGrantedText)
    statusRollsGrantedText.textContent = `Rolls granted: ${rollsGranted}`;
  if (statusRewardText)
    statusRewardText.textContent = `Reward: ${currentReward ? "£" + currentReward : "—"}`;

  if (statusCaption) {
    if (gameCompleted) {
      statusCaption.textContent = "Game complete – well done!";
    } else if (remaining <= 0) {
      statusCaption.textContent = "No rolls remaining – speak to your manager to get more.";
    } else {
      statusCaption.textContent = `You have ${remaining} roll(s) remaining.`;
    }
  }
}

// -----------------------------------------------------------------------------
// LOAD INITIAL STATE FROM BACKEND
// -----------------------------------------------------------------------------
async function loadState() {
  try {
    const res = await fetch(
      `${API}/player/state?email=${encodeURIComponent(email)}&area=${encodeURIComponent(area)}`
    );
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Unable to load player state.");
      window.location.href = "index.html";
      return;
    }

    currentPosition = data.position || 0;
    rollsUsed = data.rollsUsed || 0;
    rollsGranted = data.rollsGranted || 0;
    currentReward = data.reward ?? null;
    gameCompleted = !!data.completed;

    updateStatusUI();
    placeCounter(currentPosition);

    if (gameCompleted) {
      showCompletion(currentReward);
    }
  } catch (err) {
    console.error("Error loading state:", err);
  }
}

// -----------------------------------------------------------------------------
// ROLL HANDLING
// -----------------------------------------------------------------------------
async function handleRoll() {
  if (isAnimating || gameCompleted) return;

  try {
    diceSound.currentTime = 0;
    diceSound.play().catch(() => {});

    const res = await fetch(`${API}/player/roll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, area }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Unable to roll right now.");
      return;
    }

    const diceValue = data.dice;
    const fromPosition = data.fromPosition;
    const toPosition = data.position;

    currentPosition = data.position;
    rollsUsed = data.rollsUsed;
    rollsGranted = data.rollsGranted;
    currentReward = data.reward ?? null;
    gameCompleted = !!data.completed;

    if (diceEl) {
      diceEl.textContent = String(diceValue);
      diceEl.classList.add("dice-rolled");
      setTimeout(() => diceEl.classList.remove("dice-rolled"), 300);
    }

    // Work out if we hit a snake or ladder based on movement vs dice
    const normalEnd = Math.min(fromPosition + diceValue, FINAL_SQUARE);
    const jumped = toPosition !== normalEnd;
    const isLadder = jumped && toPosition > normalEnd;
    const isSnake = jumped && toPosition < normalEnd;

    await animateMove(fromPosition, normalEnd, toPosition, isSnake, isLadder);

    updateStatusUI();

    if (gameCompleted) {
      showCompletion(currentReward);
    }
  } catch (err) {
    console.error("Roll error:", err);
    alert("Server error – please try again.");
  }
}

if (rollBtn) {
  rollBtn.addEventListener("click", handleRoll);
}

// -----------------------------------------------------------------------------
// ANIMATION
// -----------------------------------------------------------------------------
function animateMove(fromPosition, normalEnd, finalPosition, isSnake, isLadder) {
  return new Promise((resolve) => {
    isAnimating = true;

    const path = [];
    // Step along the normal dice movement
    for (let p = fromPosition + 1; p <= normalEnd; p++) {
      path.push({ pos: p, type: "move" });
    }
    // Then jump for snake/ladder if needed
    if (finalPosition !== normalEnd) {
      path.push({
        pos: finalPosition,
        type: isSnake ? "snake" : isLadder ? "ladder" : "move",
      });
    }

    if (path.length === 0) {
      // No movement (shouldn't normally happen)
      isAnimating = false;
      resolve();
      return;
    }

    let index = 0;

    function step() {
      const stepData = path[index];
      placeCounter(stepData.pos);

      if (stepData.type === "snake") {
        snakeSound.currentTime = 0;
        snakeSound.play().catch(() => {});
      } else if (stepData.type === "ladder") {
        ladderSound.currentTime = 0;
        ladderSound.play().catch(() => {});
      } else {
        moveSound.currentTime = 0;
        moveSound.play().catch(() => {});
      }

      index++;
      if (index < path.length) {
        setTimeout(step, stepData.type === "move" ? 350 : 600);
      } else {
        isAnimating = false;
        resolve();
      }
    }

    step();
  });
}

// -----------------------------------------------------------------------------
// WIN / COMPLETION
// -----------------------------------------------------------------------------
function showCompletion(reward) {
  winSound.currentTime = 0;
  winSound.play().catch(() => {});

  // BIG confetti (requires canvas-confetti or similar loaded in HTML)
  if (typeof confetti === "function") {
    confetti({
      particleCount: 450,
      spread: 120,
      origin: { y: 0.4 },
    });
  }

  if (winMessage) {
    const rewardText =
      reward && Number.isFinite(Number(reward))
        ? `You have earned £${reward} Champions Points!`
        : "You have completed the board!";
    winMessage.textContent = rewardText;
  }

  if (winOverlay) {
    winOverlay.classList.remove("hidden");
  }
}

// Close overlay
if (winCloseBtn) {
  winCloseBtn.addEventListener("click", () => {
    winOverlay?.classList.add("hidden");
  });
}
if (winOverlay) {
  winOverlay.addEventListener("click", (e) => {
    if (e.target === winOverlay) {
      winOverlay.classList.add("hidden");
    }
  });
}

// -----------------------------------------------------------------------------
// COUNTER STYLE SELECTION
// -----------------------------------------------------------------------------
if (counterChoiceButtons && counterChoiceButtons.length > 0 && counterEl) {
  counterChoiceButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = btn.getAttribute("data-counter-theme-index");

      counterChoiceButtons.forEach((b) =>
        b.classList.remove("counter-choice-active")
      );
      btn.classList.add("counter-choice-active");

      // Remove previous theme classes
      for (let i = 1; i <= 6; i++) {
        counterEl.classList.remove(`counter-theme-${i}`);
      }
      if (index !== null) {
        const idx = parseInt(index, 10) + 1; // index 0-5 -> theme 1-6
        if (idx >= 1 && idx <= 6) {
          counterEl.classList.add(`counter-theme-${idx}`);
        }
      }
    });
  });
}

// -----------------------------------------------------------------------------
// INIT
// -----------------------------------------------------------------------------
buildBoardGrid();
loadState();

// Ensure counter stays roughly in place on resize
window.addEventListener("resize", () => {
  placeCounter(currentPosition);
});
