// game.js – Snakes & Ladders front-end
// - Uses backend API for state & rolls
// - Shows logged-in user in header
// - Animates counter over a 5x6 board
// - 6-roll rule is enforced by the backend: we only animate what the dice say
// - Dice has a simple “rolling” animation (CSS class)
// - Congratulations modal is made bigger, wired so Close always works
// - Confetti fires if canvas-confetti is present

const API = "https://snakes-ladders-backend-github.onrender.com";

/* ----------------------------------------------------
   DOM references (with some fallbacks)
---------------------------------------------------- */
const userInfoEl =
  document.getElementById("userInfo") || document.getElementById("playerName");

const logoutBtn =
  document.getElementById("btnLogout") ||
  document.getElementById("logout") ||
  document.querySelector("[data-role='logout']");

// Board overlay grid and counter
let boardGridEl =
  document.getElementById("boardGrid") ||
  document.querySelector(".board-grid") ||
  document.querySelector(".board-overlay");

let counterEl =
  document.getElementById("counter") ||
  document.querySelector(".counter") ||
  document.querySelector(".board-counter");

// Dice & roll button
const diceEl =
  document.getElementById("dice") || document.getElementById("diceValue");
const rollBtn = document.getElementById("btnRoll") || document.getElementById("rollBtn");

// Status fields
const statusPosition = document.getElementById("statusPosition");
const statusRollsUsed = document.getElementById("statusRollsUsed");
const statusRollsGranted = document.getElementById("statusRollsGranted");
const statusReward = document.getElementById("statusReward");

const statusPositionText = document.getElementById("statusPositionText");
const statusRollsUsedText = document.getElementById("statusRollsUsedText");
const statusRollsGrantedText = document.getElementById("statusRollsGrantedText");
const statusRewardText = document.getElementById("statusRewardText");
const statusCaption = document.getElementById("statusCaption");

// Win overlay + message
let winOverlay = document.getElementById("winOverlay");
let winMessage = document.getElementById("winMessage");
let winCloseBtn = document.getElementById("winCloseBtn");

// Counter style options
const counterChoiceButtons = document.querySelectorAll(".counter-choice");

// Sounds
const moveSound = new Audio("move.mp3");
const snakeSound = new Audio("snake.mp3");
const ladderSound = new Audio("ladder.mp3");
const winSound = new Audio("win.mp3");
const diceSound = new Audio("dice.mp3");

/* ----------------------------------------------------
   Player context (localStorage)
---------------------------------------------------- */
let email = localStorage.getItem("playerEmail");
let area = localStorage.getItem("playerArea");

if (!email || !area) {
  window.location.href = "index.html";
}

if (userInfoEl) {
  userInfoEl.textContent = `${email} · ${area}`;
  userInfoEl.title = `${email} (${area})`;
}

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("playerEmail");
  localStorage.removeItem("playerArea");
  window.location.href = "index.html";
});

/* ----------------------------------------------------
   Board layout
---------------------------------------------------- */
const ROWS = 5;
const COLS = 6;
const FINAL_SQUARE = 30;
const cellsByPosition = {};

function ensureOverlayAndCounter() {
  // Make sure we have an overlay grid to position 30 cells on
  if (!boardGridEl) {
    const boardImg =
      document.querySelector(".board img, .board-image, .game-board img") ||
      document.querySelector("img");
    const wrapper = boardImg ? boardImg.parentElement : document.body;

    boardGridEl = document.createElement("div");
    boardGridEl.id = "boardGrid";
    Object.assign(boardGridEl.style, {
      position: "relative",
      width: "100%",
      height: boardImg ? `${boardImg.clientHeight}px` : "560px",
      margin: "0",
    });
    wrapper && wrapper.appendChild(boardGridEl);
  }

  // Make sure a counter exists
  if (!counterEl) {
    counterEl = document.createElement("div");
    counterEl.id = "counter";
    Object.assign(counterEl.style, {
      position: "absolute",
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
      transform: "translate(-50%, -50%)",
      zIndex: "5",
      pointerEvents: "none",
      background:
        "radial-gradient(circle at 30% 30%, rgba(255,255,255,.85), rgba(255,255,255,.4) 35%, rgba(0,0,0,.15) 70%), linear-gradient(135deg,#6D28D9,#A855F7)",
      border: "2px solid rgba(255,255,255,.6)",
    });
    boardGridEl.appendChild(counterEl);
  }
}

function buildBoardGrid() {
  ensureOverlayAndCounter();

  const existingCounter = counterEl;
  boardGridEl.innerHTML = "";
  boardGridEl.appendChild(existingCounter);

  const allCells = [];
  for (let i = 0; i < FINAL_SQUARE; i++) {
    const cell = document.createElement("div");
    cell.className = "board-cell";
    Object.assign(cell.style, { position: "absolute" });
    boardGridEl.appendChild(cell);
    allCells.push(cell);
  }

  const rect = boardGridEl.getBoundingClientRect();
  const cellW = rect.width / COLS;
  const cellH = rect.height / ROWS;

  let pos = 1;
  for (let rFromBottom = 0; rFromBottom < ROWS; rFromBottom++) {
    const realRowIndex = ROWS - 1 - rFromBottom;
    const leftToRight = rFromBottom % 2 === 0; // bottom row L->R, next R->L, etc.

    for (let col = 0; col < COLS; col++) {
      const visualCol = leftToRight ? col : COLS - 1 - col;
      const x = visualCol * cellW;
      const y = realRowIndex * cellH;

      const cell = allCells[realRowIndex * COLS + col];
      Object.assign(cell.style, {
        left: `${x}px`,
        top: `${y}px`,
        width: `${cellW}px`,
        height: `${cellH}px`,
      });

      cellsByPosition[pos] = cell;
      cell.dataset.position = String(pos);
      pos++;
    }
  }
}

function placeCounter(position) {
  if (!counterEl || !boardGridEl) return;
  const cell = cellsByPosition[position];
  if (!cell) {
    counterEl.style.display = "none";
    return;
  }

  counterEl.style.display = "block";

  const gridRect = boardGridEl.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();

  const x = cellRect.left + cellRect.width / 2 - gridRect.left;
  const y = cellRect.top + cellRect.height / 2 - gridRect.top;

  counterEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
}

/* ----------------------------------------------------
   State and status UI
---------------------------------------------------- */
let currentPosition = 0;
let rollsUsed = 0;
let rollsGranted = 0;
let currentReward = null;
let gameCompleted = false;
let isAnimating = false;

function updateStatusUI() {
  const remaining = Math.max(0, rollsGranted - rollsUsed);

  if (statusPosition) statusPosition.textContent = String(currentPosition);
  if (statusRollsUsed) statusRollsUsed.textContent = String(rollsUsed);
  if (statusRollsGranted) statusRollsGranted.textContent = String(rollsGranted);
  if (statusReward)
    statusReward.textContent = currentReward ? `£${currentReward}` : "—";

  if (statusPositionText)
    statusPositionText.textContent = `Position: ${currentPosition} / ${FINAL_SQUARE}`;
  if (statusRollsUsedText)
    statusRollsUsedText.textContent = `Rolls used: ${rollsUsed}`;
  if (statusRollsGrantedText)
    statusRollsGrantedText.textContent = `Rolls granted: ${rollsGranted}`;
  if (statusRewardText)
    statusRewardText.textContent = `Reward: ${
      currentReward ? "£" + currentReward : "—"
    }`;

  if (statusCaption) {
    if (gameCompleted) {
      statusCaption.textContent = "Game complete – well done!";
    } else if (remaining <= 0) {
      statusCaption.textContent =
        "No rolls remaining – speak to your manager to get more.";
    } else {
      statusCaption.textContent = `You have ${remaining} roll(s) remaining.`;
    }
  }
}

/* ----------------------------------------------------
   Load state from backend
---------------------------------------------------- */
async function loadState() {
  try {
    const res = await fetch(
      `${API}/player/state?email=${encodeURIComponent(
        email
      )}&area=${encodeURIComponent(area)}`
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

/* ----------------------------------------------------
   Dice animation (CSS-based)
---------------------------------------------------- */
function animateDiceRolling() {
  if (!diceEl) return;
  diceEl.classList.add("rolling");
  // Let CSS handle animation; remove class after 700ms
  setTimeout(() => diceEl.classList.remove("rolling"), 700);
}

/* ----------------------------------------------------
   Roll handler – backend decides dice and 6-roll guarantee
---------------------------------------------------- */
async function handleRoll() {
  if (isAnimating || gameCompleted) return;

  try {
    diceSound.currentTime = 0;
    diceSound.play().catch(() => {});
    animateDiceRolling();

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

    const fromPosition = data.fromPosition;
    const toPosition = data.position;
    const diceValue = data.dice;

    // We show the actual dice result from the server
    if (diceEl) {
      setTimeout(() => {
        diceEl.textContent = String(diceValue);
      }, 350);
    }

    // Work out if this roll used a snake / ladder
    const normalEnd = Math.min(fromPosition + diceValue, FINAL_SQUARE);
    const jumped = toPosition !== normalEnd;
    const isLadder = jumped && toPosition > normalEnd;
    const isSnake = jumped && toPosition < normalEnd;

    currentPosition = data.position;
    rollsUsed = data.rollsUsed;
    rollsGranted = data.rollsGranted;
    currentReward = data.reward ?? null;
    gameCompleted = !!data.completed;

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

rollBtn?.addEventListener("click", handleRoll);

/* ----------------------------------------------------
   Movement animation
---------------------------------------------------- */
function animateMove(fromPosition, normalEnd, finalPosition, isSnake, isLadder) {
  return new Promise((resolve) => {
    isAnimating = true;

    const path = [];
    for (let p = fromPosition + 1; p <= normalEnd; p++) {
      path.push({ pos: p, type: "move" });
    }
    if (finalPosition !== normalEnd) {
      path.push({
        pos: finalPosition,
        type: isSnake ? "snake" : isLadder ? "ladder" : "move",
      });
    }

    if (path.length === 0) {
      isAnimating = false;
      resolve();
      return;
    }

    let index = 0;

    (function step() {
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
        setTimeout(step, stepData.type === "move" ? 340 : 600);
      } else {
        isAnimating = false;
        resolve();
      }
    })();
  });
}

/* ----------------------------------------------------
   Congratulations overlay + confetti + Close wiring
---------------------------------------------------- */
function ensureWinOverlay() {
  if (winOverlay) return;

  // If your HTML already has a nice modal, this will never run.
  winOverlay = document.createElement("div");
  winOverlay.id = "winOverlay";
  Object.assign(winOverlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(10,13,24,0.6)",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "9999",
    backdropFilter: "blur(2px)",
  });

  const card = document.createElement("div");
  card.className = "win-modal";
  Object.assign(card.style, {
    background: "linear-gradient(180deg,#15223b,#0f1a34)",
    color: "white",
    borderRadius: "24px",
    padding: "32px 38px",
    width: "min(90vw, 560px)",
    boxShadow: "0 24px 64px rgba(0,0,0,.55)",
    textAlign: "center",
  });

  const heading = document.createElement("h2");
  heading.textContent = "Congratulations!";
  Object.assign(heading.style, { fontSize: "32px", margin: "0 0 10px" });

  winMessage = document.createElement("div");
  winMessage.id = "winMessage";
  Object.assign(winMessage.style, {
    fontSize: "20px",
    opacity: ".95",
    marginBottom: "18px",
  });
  winMessage.textContent = "You have completed the board!";

  winCloseBtn = document.createElement("button");
  winCloseBtn.id = "winCloseBtn";
  winCloseBtn.textContent = "Close";
  Object.assign(winCloseBtn.style, {
    fontSize: "18px",
    padding: "10px 20px",
    borderRadius: "12px",
    border: 0,
    background: "#7C3AED",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(124,58,237,.35)",
  });

  card.appendChild(heading);
  card.appendChild(winMessage);
  card.appendChild(winCloseBtn);
  winOverlay.appendChild(card);
  document.body.appendChild(winOverlay);
}

function wireWinCloseHandlers() {
  winOverlay = document.getElementById("winOverlay") || winOverlay;
  if (!winOverlay) return;

  // Find all possible “Close” buttons inside the overlay
  const buttons = Array.from(
    winOverlay.querySelectorAll("button, .btn-close, .close-button")
  );
  buttons.forEach((btn) => {
    if (btn.dataset.winCloseWired) return;
    btn.dataset.winCloseWired = "1";
    btn.addEventListener("click", () => {
      winOverlay.classList.add("hidden");
      winOverlay.style.display = "none";
    });
  });

  // Click on dark backdrop closes as well
  if (!winOverlay.dataset.backdropWired) {
    winOverlay.dataset.backdropWired = "1";
    winOverlay.addEventListener("click", (e) => {
      if (e.target === winOverlay) {
        winOverlay.classList.add("hidden");
        winOverlay.style.display = "none";
      }
    });
  }
}

function fireConfetti() {
  if (typeof confetti !== "function") return;
  confetti({
    particleCount: 320,
    spread: 120,
    startVelocity: 45,
    origin: { y: 0.45 },
    ticks: 240,
  });
  setTimeout(() => {
    confetti({ particleCount: 180, spread: 70, origin: { x: 0.2, y: 0.5 } });
    confetti({ particleCount: 180, spread: 70, origin: { x: 0.8, y: 0.5 } });
  }, 220);
}

function showCompletion(reward) {
  winSound.currentTime = 0;
  winSound.play().catch(() => {});

  ensureWinOverlay();
  wireWinCloseHandlers();
  fireConfetti();

  if (winMessage) {
    winMessage.textContent = reward
      ? `You have earned £${reward} Champions Points!`
      : "You have completed the board!";
    winMessage.style.fontSize = "22px";
  }

  winOverlay = document.getElementById("winOverlay") || winOverlay;
  if (winOverlay) {
    winOverlay.classList.remove("hidden");
    winOverlay.style.display = "flex";
  }
}

/* ----------------------------------------------------
   Counter style selection
---------------------------------------------------- */
function applyCounterTheme(index) {
  if (!counterEl) return;
  for (let i = 1; i <= 6; i++) {
    counterEl.classList.remove(`counter-theme-${i}`);
  }
  if (index >= 1 && index <= 6) {
    counterEl.classList.add(`counter-theme-${index}`);
  }
}

function initCounterChoice() {
  const saved = parseInt(localStorage.getItem("counterTheme") || "1", 10);
  applyCounterTheme(saved);

  counterChoiceButtons.forEach((btn, i) => {
    const idx = i + 1;
    if (idx === saved) btn.classList.add("counter-choice-active");
    btn.addEventListener("click", () => {
      counterChoiceButtons.forEach((b) =>
        b.classList.remove("counter-choice-active")
      );
      btn.classList.add("counter-choice-active");
      localStorage.setItem("counterTheme", String(idx));
      applyCounterTheme(idx);
      placeCounter(currentPosition);
    });
  });
}

/* ----------------------------------------------------
   Init
---------------------------------------------------- */
buildBoardGrid();
initCounterChoice();
loadState();

window.addEventListener("resize", () => {
  placeCounter(currentPosition);
});
