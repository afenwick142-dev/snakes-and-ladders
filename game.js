// game.js
// Front-end logic for SW Snakes & Ladders
// - Works with your existing game.html + style.css
// - Uses backend at /player/* and /area/*
// - Animates the counter across the board, including snakes & ladders
// - Shows big congratulations modal + confetti
// - Dice shows a spinning animation, then the final face

const API = "https://snakes-ladders-backend-github.onrender.com";

// ---- DOM references ----
const userInfoEl = document.getElementById("userInfo");
const logoutBtn = document.getElementById("btnLogout");

let boardGridEl = document.getElementById("boardGrid");
let counterEl = document.getElementById("counter");

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

// counter style choices
const counterChoiceButtons = document.querySelectorAll(".counter-choice");

// confetti canvas
const confettiCanvas = document.getElementById("confetti");

// winner overlay
let winOverlay = document.getElementById("winOverlay");
let winMessage = document.getElementById("winMessage");
let winCloseBtn = document.getElementById("winCloseBtn");

// ---- sounds ----
const moveSound = new Audio("move.mp3");
const snakeSound = new Audio("snake.mp3");
const ladderSound = new Audio("ladder.mp3");
const winSound = new Audio("win.mp3");
const diceSound = new Audio("dice.mp3");

// ---- Player session ----
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

// ---- Board constants ----
const ROWS = 5;
const COLS = 6;
const FINAL_SQUARE = 30;

// ladders and snakes
const JUMPS = {
  3: 22,
  5: 8,
  11: 26,
  20: 29,
  17: 4,
  19: 7,
  27: 1
};

const SNAKE_HEADS = new Set([17, 19, 27]);
const LADDER_BASES = new Set([3, 5, 11, 20]);

// map from position -> cell element
const cellsByPosition = {};

// ---- Ensure overlay + counter exist ----
function ensureOverlayAndCounter() {
  if (!boardGridEl) {
    const boardContainer =
      document.querySelector(".board-container") ||
      document.querySelector(".card-board") ||
      document.body;

    boardGridEl = document.createElement("div");
    boardGridEl.id = "boardGrid";
    boardGridEl.className = "board-grid";
    Object.assign(boardGridEl.style, {
      position: "relative",
      width: "100%",
      height: "100%"
    });

    boardContainer.appendChild(boardGridEl);
  }

  if (!counterEl) {
    counterEl = document.createElement("div");
    counterEl.id = "counter";
    counterEl.className = "counter";
    counterEl.style.position = "absolute";
    counterEl.style.transform = "translate(-9999px, -9999px)";
    counterEl.style.zIndex = "10";
    boardGridEl.appendChild(counterEl);
  }
}

// ---- Board generation ----
function buildBoardGrid() {
  ensureOverlayAndCounter();

  const existingCounter = counterEl;
  boardGridEl.innerHTML = "";
  boardGridEl.appendChild(existingCounter);

  const rect = boardGridEl.getBoundingClientRect();
  const cellW = rect.width / COLS;
  const cellH = rect.height / ROWS;

  let pos = 1;
  for (let rowFromBottom = 0; rowFromBottom < ROWS; rowFromBottom++) {
    const visualRow = ROWS - 1 - rowFromBottom;
    const leftToRight = rowFromBottom % 2 === 0;

    for (let col = 0; col < COLS; col++) {
      const visualCol = leftToRight ? col : COLS - 1 - col;
      const x = visualCol * cellW;
      const y = visualRow * cellH;

      const cell = document.createElement("div");
      cell.className = "board-cell";
      cell.dataset.square = String(pos);
      Object.assign(cell.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${cellW}px`,
        height: `${cellH}px`
      });

      boardGridEl.appendChild(cell);
      cellsByPosition[pos] = cell;
      pos++;
    }
  }
}

function getCellCenter(square) {
  const cell = cellsByPosition[square];
  if (!cell || !boardGridEl) return { x: 0, y: 0 };
  const gridRect = boardGridEl.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const x = cellRect.left + cellRect.width / 2 - gridRect.left;
  const y = cellRect.top + cellRect.height / 2 - gridRect.top;
  return { x, y };
}

// ---- Counter placement ----
function placeCounter(square) {
  if (!boardGridEl || !counterEl) return;
  if (square < 1) square = 1;
  if (square > FINAL_SQUARE) square = FINAL_SQUARE;

  const cell = cellsByPosition[square];
  if (!cell) return;

  const gridRect = boardGridEl.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();

  const x = cellRect.left + cellRect.width / 2 - gridRect.left;
  const y = cellRect.top + cellRect.height / 2 - gridRect.top;

  const size = Math.min(cellRect.width, cellRect.height) * 0.7;
  counterEl.style.width = `${size}px`;
  counterEl.style.height = `${size}px`;
  counterEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  counterEl.classList.remove("hidden");
}

// ---- Counter style selection ----
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
      placeCounter(currentPosition || 1);
    });
  });
}

// ---- State ----
let currentPosition = 0;
let rollsUsed = 0;
let rollsGranted = 0;
let currentReward = null;
let gameCompleted = false;

// ---- Status UI ----
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
      statusCaption.textContent =
        "You have reached square 30 – your reward is locked in.";
    } else if (remaining <= 0) {
      statusCaption.textContent =
        "No rolls remaining – speak to your manager to get more.";
    } else {
      statusCaption.textContent = `You have ${remaining} roll(s) remaining.`;
    }
  }
}

// ---- Load state from backend ----
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
    if (currentPosition > 0) {
      placeCounter(currentPosition);
    }

    if (gameCompleted) {
      showCompletion(currentReward);
    }
  } catch (err) {
    console.error("Error loading state:", err);
  }
}

// ---- Dice animation ----
function animateDiceRolling() {
  if (!diceEl) return;
  // match .dice.spin in style.css
  diceEl.classList.add("spin");
  setTimeout(() => diceEl.classList.remove("spin"), 700);
}

// ---- Roll button handler ----
async function handleRoll() {
  if (gameCompleted) return;

  try {
    diceSound.currentTime = 0;
    diceSound.play().catch(() => {});
    animateDiceRolling();

    const res = await fetch(`${API}/player/roll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, area })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Unable to roll right now.");
      return;
    }

    const diceValue = data.dice;
    const fromPosition = data.fromPosition;
    const toPosition = data.position;

    if (diceEl) {
      // small delay before final value appears, so the spin is visible
      setTimeout(() => {
        diceEl.textContent = String(diceValue);
      }, 350);
    }

    const normalEnd = Math.min(fromPosition + diceValue, FINAL_SQUARE);
    const jumped = toPosition !== normalEnd;
    const isSnake = jumped && toPosition < normalEnd;
    const isLadder = jumped && toPosition > normalEnd;

    currentPosition = toPosition;
    rollsUsed = data.rollsUsed;
    rollsGranted = data.rollsGranted;
    currentReward = data.reward ?? null;
    gameCompleted = !!data.completed;

    // tiny delay between dice resolving and the counter starting to move
    await new Promise((resolve) => setTimeout(resolve, 150));
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

// ---- Movement animation ----
function animateSnakeSlide(startPos, endPos) {
  return new Promise((resolve) => {
    snakeSound.currentTime = 0;
    snakeSound.play().catch(() => {});

    const start = getCellCenter(startPos);
    const end = getCellCenter(endPos);

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const offset = (start.y < end.y ? -1 : 1) * 80;
    const ctrl = { x: midX, y: midY + offset };

    const duration = 800;
    const startTime = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const inv = 1 - t;

      const x =
        inv * inv * start.x + 2 * inv * t * ctrl.x + t * t * end.x;
      const y =
        inv * inv * start.y + 2 * inv * t * ctrl.y + t * t * end.y;

      counterEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

function animateLadderClimb(startPos, endPos) {
  return new Promise((resolve) => {
    ladderSound.currentTime = 0;
    ladderSound.play().catch(() => {});

    const start = getCellCenter(startPos);
    const end = getCellCenter(endPos);
    const duration = 700;
    const startTime = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;

      counterEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

function animateMove(fromPosition, normalEnd, finalPosition, isSnake, isLadder) {
  return new Promise((resolve) => {
    const pathSquares = [];
    for (let p = fromPosition + 1; p <= normalEnd; p++) {
      pathSquares.push(p);
    }

    let index = 0;

    function stepSquares() {
      if (index >= pathSquares.length) {
        if (finalPosition !== normalEnd) {
          if (isSnake) {
            animateSnakeSlide(normalEnd, finalPosition).then(endSequence);
          } else if (isLadder) {
            animateLadderClimb(normalEnd, finalPosition).then(endSequence);
          } else {
            endSequence();
          }
        } else {
          endSequence();
        }
        return;
      }

      const pos = pathSquares[index++];
      placeCounter(pos);
      moveSound.currentTime = 0;
      moveSound.play().catch(() => {});
      setTimeout(stepSquares, 260);
    }

    function endSequence() {
      placeCounter(finalPosition);
      resolve();
    }

    if (pathSquares.length === 0) {
      if (isSnake) {
        animateSnakeSlide(fromPosition, finalPosition).then(endSequence);
      } else if (isLadder) {
        animateLadderClimb(fromPosition, finalPosition).then(endSequence);
      } else {
        endSequence();
      }
    } else {
      stepSquares();
    }
  });
}

// ---- Confetti ----
function triggerConfetti() {
  if (!confettiCanvas) return;

  confettiCanvas.innerHTML = "";
  confettiCanvas.classList.add("show");

  const colors = [
    "#f97316",
    "#22c55e",
    "#38bdf8",
    "#6366f1",
    "#e11d48",
    "#facc15",
    "#ffffff"
  ];

  const pieces = 160;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.animationDelay = Math.random() * 0.7 + "s";
    piece.style.opacity = String(0.7 + Math.random() * 0.3);
    piece.style.backgroundColor = colors[i % colors.length];
    confettiCanvas.appendChild(piece);
  }

  setTimeout(() => {
    confettiCanvas.classList.remove("show");
    confettiCanvas.innerHTML = "";
  }, 2300);
}

// ---- Winner overlay ----
function showCompletion(reward) {
  setTimeout(() => {
    triggerConfetti();
  }, 200);

  setTimeout(() => {
    if (!winOverlay || !winMessage) return;

    winMessage.textContent = `You have earned £${reward || 10} Champions Points!`;
    winOverlay.classList.remove("hidden");
    winSound.currentTime = 0;
    winSound.play().catch(() => {});
  }, 2400);
}

winCloseBtn?.addEventListener("click", () => {
  winOverlay?.classList.add("hidden");
});

// ---- Init ----
buildBoardGrid();
initCounterChoice();
loadState();

window.addEventListener("resize", () => {
  if (currentPosition > 0) placeCounter(currentPosition);
});
