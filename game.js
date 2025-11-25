const API_BASE = "https://snakes-ladders-backend.onrender.com";

// ---------- DOM REFERENCES ----------
const boardGrid = document.getElementById("boardGrid");
const counterEl = document.getElementById("counter");
const userInfoEl = document.getElementById("userInfo");
const btnLogout = document.getElementById("btnLogout");
const btnRoll = document.getElementById("btnRoll");
const diceEl = document.getElementById("dice");

// Numeric progress (right-hand panel)
const posValueEl = document.getElementById("statusPosition");
const rollsUsedValueEl = document.getElementById("statusRollsUsed");
const rollsGrantedValueEl = document.getElementById("statusRollsGranted");
const rewardValueEl = document.getElementById("statusReward");

// Text status card
const posTextEl = document.getElementById("statusPositionText");
const rollsUsedTextEl = document.getElementById("statusRollsUsedText");
const rollsGrantedTextEl = document.getElementById("statusRollsGrantedText");
const rewardTextEl = document.getElementById("statusRewardText");

const captionEl = document.getElementById("statusCaption");
const confettiEl = document.getElementById("confetti");
const winOverlayEl = document.getElementById("winOverlay");
const winMessageEl = document.getElementById("winMessage");
const winCloseBtn = document.getElementById("winCloseBtn");

// counter colour choice buttons
const counterChoiceButtons = document.querySelectorAll("[data-counter-theme-index]");

// dice faces
const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

// ---------- SOUNDS ----------
// Timing gaps (ms)
const DICE_TO_MOVE_DELAY = 700;     // gap after dice sound before counter moves
const MOVE_TO_EFFECT_DELAY = 600;   // gap after movement before ladder/snake sound

let moveSound, ladderSound, snakeSound, winSound, diceSound;
try {
  moveSound = new Audio("move.mp3");
  ladderSound = new Audio("ladder.mp3");
  snakeSound = new Audio("snake.mp3");
  winSound = new Audio("win.mp3");
  diceSound = new Audio("dice.mp3");
} catch {
  // ignore audio errors
}
function playSound(sound) {
  if (!sound) return;
  try {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  } catch {}
}

// ---------- BOARD CONSTANTS & LAYOUT ----------

const BOARD_COLS = 6;
const BOARD_ROWS = 5;
const BOARD_SIZE = 30;

// Snakes & ladders (for animation only – backend already applies these)
const SNAKES = {
  17: 4,
  19: 7,
  27: 1,
};
const LADDERS = {
  3: 22,
  5: 8,
  11: 26,
  20: 29,
};

// squareNumber -> DOM cell
const squareCells = {};

// Return the square number for a given visual row/col.
// row 0 = top, row 4 = bottom.
function squareNumberForRowCol(row, col) {
  switch (row) {
    case 4: // bottom row: 1..6 left->right
      return 1 + col;
    case 3: // 2nd from bottom: 12..7 left->right (right->left numerically)
      return 12 - col;
    case 2: // middle: 13..18 left->right
      return 13 + col;
    case 1: // 2nd from top: 24..19 left->right (right->left numerically)
      return 24 - col;
    case 0: // top: 25..30 left->right
      return 25 + col;
    default:
      return null;
  }
}

// Build the overlay grid so each cell is the *correct* square number
// in the correct physical place on your board image.
function buildBoard() {
  if (!boardGrid) return;
  boardGrid.innerHTML = "";
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const num = squareNumberForRowCol(row, col);
      if (!num) continue;
      const cell = document.createElement("div");
      cell.className = "board-cell";
      cell.dataset.square = String(num);

      // Optional overlay labels – uncomment if you want to see the numbers.
      // const label = document.createElement("span");
      // label.className = "cell-number";
      // label.textContent = String(num);
      // cell.appendChild(label);

      boardGrid.appendChild(cell);
      squareCells[num] = cell;
    }
  }
}

// Get cell centre in boardGrid coordinates for a square number
function getCellCenter(num) {
  if (!boardGrid) return null;
  const cell = squareCells[num];
  if (!cell) return null;

  const rect = cell.getBoundingClientRect();
  const boardRect = boardGrid.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2 - boardRect.left,
    y: rect.top + rect.height / 2 - boardRect.top,
  };
}

// ---------- COUNTER MOVEMENT HELPERS ----------

let session = null;
let currentPosition = 0; // 0 = off-board before square 1
let rolling = false;

function placeCounterOn(pos) {
  if (!counterEl) return;

  if (!pos || pos < 1 || pos > BOARD_SIZE) {
    counterEl.classList.add("hidden");
    return;
  }
  const center = getCellCenter(pos);
  if (!center) {
    counterEl.classList.add("hidden");
    return;
  }
  counterEl.classList.remove("hidden");
  counterEl.style.left = `${center.x}px`;
  counterEl.style.top = `${center.y}px`;
}

// Simple step animation along numeric squares (1,2,3,4...)
// from/to are numeric square numbers (0–30)
function animateStep(from, to, onDone, playStepSound = true) {
  if (from <= 0) {
    placeCounterOn(to);
    if (playStepSound) playSound(moveSound);
    if (onDone) onDone();
    return;
  }

  if (from === to) {
    placeCounterOn(to);
    if (onDone) onDone();
    return;
  }

  const step = from < to ? 1 : -1;
  let pos = from;
  placeCounterOn(pos);

  const timer = setInterval(() => {
    pos += step;
    placeCounterOn(pos);
    if (playStepSound) playSound(moveSound);
    if (pos === to) {
      clearInterval(timer);
      if (onDone) onDone();
    }
  }, 260);
}

// Straight-line animation following a snake/ladder along the artwork.
function animateShortcut(from, to, onDone) {
  const start = getCellCenter(from);
  const end = getCellCenter(to);
  if (!start || !end || !counterEl) {
    placeCounterOn(to);
    if (onDone) onDone();
    return;
  }

  let progress = 0;
  const steps = 18;
  const dx = (end.x - start.x) / steps;
  const dy = (end.y - start.y) / steps;

  counterEl.style.left = `${start.x}px`;
  counterEl.style.top = `${start.y}px`;

  const timer = setInterval(() => {
    progress++;
    counterEl.style.left = `${start.x + dx * progress}px`;
    counterEl.style.top = `${start.y + dy * progress}px`;

    if (progress >= steps) {
      clearInterval(timer);
      placeCounterOn(to);
      if (onDone) onDone();
    }
  }, 35);
}

// ---------- CONFETTI / WIN OVERLAY ----------

function fireConfetti() {
  if (!confettiEl) return;

  confettiEl.innerHTML = "";
  confettiEl.classList.add("show");

  const colours = ["#f97316", "#22c55e", "#3b82f6", "#e11d48", "#a855f7", "#eab308"];
  const pieces = 180;

  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colours[i % colours.length];
    piece.style.animationDelay = `${Math.random() * 0.7}s`;
    confettiEl.appendChild(piece);
  }

  setTimeout(() => {
    confettiEl.classList.remove("show");
    confettiEl.innerHTML = "";
  }, 2400);
}

function showWin(rewardText) {
  playSound(winSound);
  fireConfetti();
  if (winOverlayEl && winMessageEl) {
    winMessageEl.textContent = rewardText || "You finished the board!";
    setTimeout(() => {
      winOverlayEl.classList.remove("hidden");
    }, 2000);
  }
}

if (winCloseBtn && winOverlayEl) {
  winCloseBtn.addEventListener("click", () => {
    winOverlayEl.classList.add("hidden");
  });
}

// ---------- STATUS / SESSION HELPERS ----------

function updateStatusFromGame(game, options = {}) {
  if (!game) return;
  const { updateCounter = true } = options;

  const pos = game.current_position ?? 0;
  currentPosition = pos;

  if (posValueEl) posValueEl.textContent = String(pos);
  if (rollsUsedValueEl) rollsUsedValueEl.textContent = String(game.rolls_used ?? 0);
  if (rollsGrantedValueEl) rollsGrantedValueEl.textContent = String(game.rolls_granted ?? 0);
  if (rewardValueEl) rewardValueEl.textContent =
    game.reward_won || (game.completed ? "Pending" : "—");

  if (posTextEl) posTextEl.textContent = `Position: ${pos} / ${BOARD_SIZE}`;
  if (rollsUsedTextEl) rollsUsedTextEl.textContent = `Rolls used: ${game.rolls_used ?? 0}`;
  if (rollsGrantedTextEl)
    rollsGrantedTextEl.textContent = `Rolls granted: ${game.rolls_granted ?? 0}`;
  if (rewardTextEl)
    rewardTextEl.textContent =
      `Reward: ${game.reward_won || (game.completed ? "Pending" : "—")}`;

  if (updateCounter) {
    if (pos > 0) placeCounterOn(pos);
    else placeCounterOn(0);
  }
}

function renderUserInfo(user) {
  if (!userInfoEl || !user) return;
  const name = user.username || (session && session.username) || "Player";
  const sw = user.sw_code || (session && session.swCode) || "";
  userInfoEl.textContent = sw ? `${name} – ${sw}` : name;
}

function loadSession() {
  try {
    const raw = localStorage.getItem("sl_session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem("sl_session");
  } catch {}
}

// ---------- ROLL LOGIC ----------

async function rollDice() {
  if (!session || rolling) return;
  rolling = true;

  try {
    if (diceEl) diceEl.classList.add("spin");
    playSound(diceSound);

    const res = await fetch(`${API_BASE}/api/roll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.userId }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const message = (errData && errData.error) || "Unable to roll.";
      if (captionEl) captionEl.textContent = message;
      return;
    }

    const data = await res.json();
    const { roll, eventType, game, reward } = data;

    if (diceEl && roll != null) {
      const face = DICE_FACES[roll - 1] || String(roll);
      diceEl.textContent = face;
    }

    const oldPos = currentPosition ?? 0;
    const newPos = game && (game.current_position ?? oldPos);
    const completed = !!(game && game.completed && reward);

    // Update labels; we'll animate the counter separately.
    updateStatusFromGame(game, { updateCounter: false });

    const afterMove = () => {
      if (captionEl && data.caption) captionEl.textContent = data.caption;
      if (completed) {
        const finalPos = game.current_position ?? BOARD_SIZE;
        currentPosition = finalPos;
        placeCounterOn(finalPos);
        showWin(reward);
      }
    };

    const playPerCell = !completed && eventType !== "ladder" && eventType !== "snake";

    // Start movement after a gap so the dice sound can play cleanly
    const startMovement = () => {
      if (eventType === "ladder" || eventType === "snake") {
        const rollTarget = Math.min(oldPos + roll, BOARD_SIZE);
        const effectSound = eventType === "ladder" ? ladderSound : snakeSound;

        // First animate stepping to the ladder/snake square (no step sounds),
        // then, after a gap, play the effect sound and slide along the artwork.
        animateStep(
          oldPos,
          rollTarget,
          () => {
            setTimeout(() => {
              playSound(effectSound);
              animateShortcut(rollTarget, newPos, afterMove);
            }, MOVE_TO_EFFECT_DELAY);
          },
          false
        );
      } else {
        // Normal move – step sounds only
        animateStep(oldPos, newPos, afterMove, playPerCell);
      }
    };

    setTimeout(startMovement, DICE_TO_MOVE_DELAY);
  } catch (err) {
    console.error("rollDice error", err);
    if (captionEl) captionEl.textContent = "Something went wrong rolling the dice.";
  } finally {
    if (diceEl) setTimeout(() => diceEl.classList.remove("spin"), 300);
    rolling = false;
  }
}

// ---------- INITIAL LOAD ----------

async function loadGameFromSession() {
  const sess = loadSession();
  if (!sess) {
    window.location.href = "index.html";
    return;
  }
  session = sess;

  try {
    const res = await fetch(`${API_BASE}/api/game?userId=${session.userId}`);
    if (!res.ok) {
      clearSession();
      window.location.href = "index.html";
      return;
    }

    const data = await res.json();
    const { user, game } = data;

    renderUserInfo(user);
    updateStatusFromGame(game, { updateCounter: true });

    if (captionEl) {
      captionEl.textContent = "You have up to six rolls. Good luck!";
    }
  } catch (err) {
    console.error("loadGameFromSession error", err);
    if (captionEl)
      captionEl.textContent = "Unable to load your game. Please try again.";
  }
}

// ---------- LOGOUT & INPUT HANDLERS ----------

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });
}

if (btnRoll) {
  btnRoll.addEventListener("click", rollDice);
}

// use spacebar to roll (not when typing in an input)
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.key === " ") {
    const active = document.activeElement;
    if (active && active.tagName && active.tagName.toLowerCase() === "input") {
      return;
    }
    rollDice();
  }
});

// ---------- COUNTER THEME PICKER ----------

function initCounterThemes() {
  if (!counterEl || !counterChoiceButtons.length) return;

  const themeClasses = [
    "counter-theme-1",
    "counter-theme-2",
    "counter-theme-3",
    "counter-theme-4",
    "counter-theme-5",
    "counter-theme-6",
  ];

  const applyThemeByIndex = (index) => {
    counterEl.classList.remove(...themeClasses);
    const themeClass = themeClasses[index] || themeClasses[0];
    counterEl.classList.add(themeClass);
  };

  // Default selection – first counter
  applyThemeByIndex(0);

  counterChoiceButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = parseInt(btn.dataset.counterThemeIndex || "0", 10);
      applyThemeByIndex(index);
    });
  });
}

// ---------- BOOTSTRAP ----------
buildBoard();
initCounterThemes();
loadGameFromSession();
