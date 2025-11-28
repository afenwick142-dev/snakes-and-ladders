// game.js
// Front-end logic for Snakes & Ladders
// - Works with existing game.html + style.css from your project
// - Uses backend at /player/* and /area/*
// - Animates piece across the board
// - S1: snakes slide along a curved path
// - L1: ladders climb vertically
// - Shows big congratulations modal + confetti
// - Dice shows a rolling animation, then the final face

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

// confetti canvas – this class already exists in your HTML
const confettiCanvas = document.getElementById("confetti");

// winner overlay
let winOverlay = document.getElementById("winOverlay");
let winMessage = document.getElementById("winMessage");
let winCloseBtn = document.getElementById("winCloseBtn");

// ---- sounds (optional, fail-safe if files missing) ----
const moveSound = new Audio("move.mp3");
const snakeSound = new Audio("snake.mp3");
const ladderSound = new Audio("ladder.mp3");
const winSound = new Audio("win.mp3");
const diceSound = new Audio("dice.mp3");

// ---- Player session ----
let email = localStorage.getItem("playerEmail");
let area = localStorage.getItem("playerArea");

if (!email || !area) {
  // Not logged in properly
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

// ladders and snakes as agreed
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

// ---- Game state ----
let currentPosition = 0;
let rollsUsed = 0;
let rollsGranted = 0;
let currentReward = null;
let gameCompleted = false;
let isAnimating = false;

// ---- Board helpers ----
function getBoardCoords(square) {
  if (square < 1 || square > FINAL_SQUARE) {
    return { row: 0, col: 0 };
  }
  const index = square - 1;
  const row = Math.floor(index / COLS);
  const isEvenRow = row % 2 === 0;
  const colInRow = index % COLS;
  const col = isEvenRow ? colInRow : COLS - 1 - colInRow;
  return { row, col };
}

function getCellCenter(square) {
  if (!boardGridEl) return { x: 0, y: 0 };
  const cell = boardGridEl.querySelector(`[data-square="${square}"]`);
  if (!cell) return { x: 0, y: 0 };
  const rect = cell.getBoundingClientRect();
  const boardRect = boardGridEl.getBoundingClientRect();
  return {
    x: rect.left - boardRect.left + rect.width / 2,
    y: rect.top - boardRect.top + rect.height / 2
  };
}

// ---- Board generation ----
function buildBoard() {
  if (!boardGridEl || !counterEl) return;

  const counter = counterEl;
  boardGridEl.innerHTML = "";
  boardGridEl.style.position = "relative";

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const squareNumber = r * COLS + (r % 2 === 0 ? c + 1 : COLS - c);
      const cell = document.createElement("div");
      cell.className = "board-cell";
      cell.dataset.square = String(squareNumber);
      boardGridEl.appendChild(cell);
    }
  }

  counter.classList.remove("hidden");
  placeCounter(currentPosition || 1);
}

// ---- Counter placement ----
function placeCounter(square) {
  if (!boardGridEl || !counterEl) return;
  if (square < 1) square = 1;
  if (square > FINAL_SQUARE) square = FINAL_SQUARE;

  const cell = boardGridEl.querySelector(`[data-square="${square}"]`);
  if (!cell) return;

  const cellRect = cell.getBoundingClientRect();
  const boardRect = boardGridEl.getBoundingClientRect();

  const offsetX = cellRect.left - boardRect.left;
  const offsetY = cellRect.top - boardRect.top;

  const centerX = offsetX + cellRect.width / 2;
  const centerY = offsetY + cellRect.height / 2;

  const counterSize = Math.min(cellRect.width, cellRect.height) * 0.7;
  counterEl.style.width = `${counterSize}px`;
  counterEl.style.height = `${counterSize}px`;

  counterEl.style.transform = `translate(${centerX - counterSize / 2}px, ${
    centerY - counterSize / 2
  }px)`;
}

// ---- Counter style selection ----
counterChoiceButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const theme = btn.getAttribute("data-theme");
    const index = btn.getAttribute("data-counter-theme-index") || "0";

    counterChoiceButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    if (!counterEl) return;

    const themeIndex = parseInt(index, 10) || 0;
    const colors = [
      "#f97316",
      "#22c55e",
      "#38bdf8",
      "#6366f1",
      "#e11d48",
      "#facc15"
    ];

    const color = colors[themeIndex] || "#f97316";
    counterEl.style.background = `radial-gradient(circle at 30% 30%, #fefce8, ${color})`;
    counterEl.style.boxShadow = "0 12px 18px rgba(15, 23, 42, 0.9)";
  });
});

// ---- Status UI ----
function getPotentialReward(position, rollsUsed, rollsGranted) {
  if (position === FINAL_SQUARE && gameCompleted && currentReward != null) {
    return `£${currentReward} Champions`;
  }
  const baseReward = 10;

  if (!gameCompleted) {
    return "—";
  }
  return `£${baseReward} Champions`;
}

function isGuaranteedReward(position, rollsUsed, rollsGranted) {
  if (position < FINAL_SQUARE) return false;
  return true;
}

function updateStatusUI() {
  if (!statusPosition) return;

  statusPosition.textContent = String(currentPosition);
  statusRollsUsed.textContent = String(rollsUsed);
  statusRollsGranted.textContent = String(rollsGranted);
  statusReward.textContent = getPotentialReward(
    currentPosition,
    rollsUsed,
    rollsGranted
  );

  statusPositionText.textContent = `Position: ${currentPosition} / ${FINAL_SQUARE}`;
  statusRollsUsedText.textContent = `Rolls used: ${rollsUsed}`;
  statusRollsGrantedText.textContent = `Rolls granted: ${rollsGranted}`;
  statusRewardText.textContent = `Reward: ${getPotentialReward(
    currentPosition,
    rollsUsed,
    rollsGranted
  )}`;

  if (isGuaranteedReward(currentPosition, rollsUsed, rollsGranted)) {
    statusCaption.textContent =
      "You have reached square 30 – your reward is locked in.";
  } else {
    statusCaption.textContent = "";
  }
}

// ---- Confetti ----
function triggerConfetti() {
  if (!confettiCanvas) return;

  confettiCanvas.innerHTML = "";
  confettiCanvas.classList.add("show");

  const colors = ["#f97316", "#22c55e", "#38bdf8", "#a855f7", "#facc15", "#f43f5e"];

  for (let i = 0; i < 120; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = Math.random() * 0.3 + "s";
    confettiCanvas.appendChild(piece);
  }

  setTimeout(() => {
    confettiCanvas.classList.remove("show");
    confettiCanvas.innerHTML = "";
  }, 2200);
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

// ---- Dice animation ----
function animateDiceRolling() {
  if (!diceEl) return;
  // Add CSS class that triggers the spin animation in style.css (.dice.spin)
  diceEl.classList.add("spin");
  // Remove it again after the animation so the next roll can retrigger it
  setTimeout(() => diceEl.classList.remove("spin"), 700);
}

// ---- Roll button handler ----
async function handleRoll() {
  if (isAnimating || gameCompleted) return;

  try {
    diceSound.currentTime = 0;
    diceSound.play().catch(() => {});
    animateDiceRolling();

    const res = await fetch(`${API}/player/roll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, area })
    });

    if (!res.ok) {
      throw new Error("Roll failed");
    }

    const data = await res.json();

    if (!data.success) {
      alert(data.error || "Unable to roll right now.");
      return;
    }

    const {
      fromPosition,
      toPosition,
      diceValue,
      rollsUsed: newRollsUsed,
      rollsGranted: newRollsGranted,
      reward,
      completed,
      guaranteedSix
    } = data;

    if (diceEl) {
      diceEl.textContent = String(diceValue);
    }

    currentPosition = toPosition;
    rollsUsed = newRollsUsed;
    rollsGranted = newRollsGranted;
    currentReward = reward;
    gameCompleted = completed;

    const normalEnd = Math.min(
      fromPosition + diceValue,
      FINAL_SQUARE
    );
    const isSnake = SNAKE_HEADS.has(normalEnd) && JUMPS[normalEnd] === toPosition;
    const isLadder =
      LADDER_BASES.has(fromPosition) && JUMPS[fromPosition] === toPosition;

    isAnimating = true;
    await animateMove(fromPosition, diceValue, toPosition, isSnake, isLadder);
    isAnimating = false;

    updateStatusUI();

    if (gameCompleted) {
      showCompletion(currentReward);
    }
  } catch (err) {
    console.error("Roll error:", err);
    alert("Server error – please try again.");
    isAnimating = false;
  }
}

rollBtn?.addEventListener("click", handleRoll);

// ---- Movement animation ----
function animateMove(fromPosition, diceValue, finalPosition, isSnake, isLadder) {
  return new Promise((resolve) => {
    const pathSquares = [];
    const normalEnd = Math.min(fromPosition + diceValue, FINAL_SQUARE);
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

      const counterSize = counterEl.offsetWidth;
      counterEl.style.transform = `translate(${x - counterSize / 2}px, ${
        y - counterSize / 2
      }px)`;

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

      const counterSize = counterEl.offsetWidth;
      counterEl.style.transform = `translate(${x - counterSize / 2}px, ${
        y - counterSize / 2
      }px)`;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

// ---- Load initial state from backend ----
async function loadInitialState() {
  try {
    const res = await fetch(`${API}/player/state?email=${encodeURIComponent(
      email
    )}&area=${encodeURIComponent(area)}`);

    if (!res.ok) {
      throw new Error("Failed to load state");
    }

    const data = await res.json();

    if (!data.success) {
      alert(data.error || "Unable to load your game right now.");
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
    } else {
      placeCounter(1);
    }

    if (gameCompleted) {
      showCompletion(currentReward);
    }
  } catch (err) {
    console.error("Error loading state:", err);
  }
}

window.addEventListener("resize", () => {
  if (currentPosition > 0) {
    placeCounter(currentPosition);
  }
});

// ---- Init ----
buildBoard();
loadInitialState();
