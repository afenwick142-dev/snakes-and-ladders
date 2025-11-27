// game.js
// Front-end logic for Snakes & Ladders

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

// confetti overlay container (already in HTML)
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

// ---- Board helpers ----
function indexToRowCol(square) {
  const zero = square - 1;
  const rowFromBottom = Math.floor(zero / COLS);
  const colInRow = zero % COLS;
  const row = ROWS - 1 - rowFromBottom;
  const isOddRowFromBottom = rowFromBottom % 2 === 1;

  const col = isOddRowFromBottom ? COLS - 1 - colInRow : colInRow;
  return { row, col };
}

function buildBoardGrid() {
  if (!boardGridEl) return;

  const boardRect = boardGridEl.getBoundingClientRect();
  const cellWidth = boardRect.width / COLS;
  const cellHeight = boardRect.height / ROWS;

  const frag = document.createDocumentFragment();

  for (let square = 1; square <= FINAL_SQUARE; square++) {
    const { row, col } = indexToRowCol(square);
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    cell.dataset.square = String(square);
    cell.style.position = "absolute";
    cell.style.left = `${col * cellWidth}px`;
    cell.style.top = `${row * cellHeight}px`;
    cell.style.width = `${cellWidth}px`;
    cell.style.height = `${cellHeight}px`;
    frag.appendChild(cell);
  }

  boardGridEl.innerHTML = "";
  boardGridEl.style.position = "relative";
  boardGridEl.appendChild(frag);
}

function getCellCenter(square) {
  const cell = boardGridEl.querySelector(`[data-square="${square}"]`);
  if (!cell) return { x: 0, y: 0 };
  const rect = cell.getBoundingClientRect();
  const boardRect = boardGridEl.getBoundingClientRect();
  const x = rect.left - boardRect.left + rect.width / 2;
  const y = rect.top - boardRect.top + rect.height / 2;
  return { x, y };
}

function placeCounter(position) {
  if (!counterEl || !boardGridEl) return;
  const { x, y } = getCellCenter(position);
  counterEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  counterEl.classList.remove("hidden");
}

// ---- State ----
let currentPosition = 0;
let rollsUsed = 0;
let rollsGranted = 0;
let currentReward = null;
let gameCompleted = false;
let isAnimating = false;

// ---- Status UI ----
function updateStatusUI() {
  const remaining = Math.max(0, rollsGranted - rollsUsed);
  const squaresLeft = Math.max(0, FINAL_SQUARE - currentPosition);

  // "Guaranteed to complete" purely on worst-case rolls of 1 (no jumps)
  const isGuaranteed =
    !gameCompleted && squaresLeft > 0 && remaining >= squaresLeft;

  const potentialReward =
    currentReward != null ? currentReward : isGuaranteed ? 10 : null;

  if (statusPosition) statusPosition.textContent = String(currentPosition);
  if (statusRollsUsed) statusRollsUsed.textContent = String(rollsUsed);
  if (statusRollsGranted) statusRollsGranted.textContent = String(rollsGranted);
  if (statusReward)
    statusReward.textContent = potentialReward
      ? `£${potentialReward}`
      : "—";

  if (statusPositionText)
    statusPositionText.textContent = `Position: ${currentPosition} / ${FINAL_SQUARE}`;
  if (statusRollsUsedText)
    statusRollsUsedText.textContent = `Rolls used: ${rollsUsed}`;
  if (statusRollsGrantedText)
    statusRollsGrantedText.textContent = `Rolls granted: ${rollsGranted}`;
  if (statusRewardText)
    statusRewardText.textContent = `Reward: ${
      currentReward != null
        ? "£" + currentReward
        : isGuaranteed
        ? "£10 (guaranteed)"
        : "—"
    }`;

  if (statusCaption) {
    if (gameCompleted) {
      statusCaption.textContent = "Game complete – well done!";
    } else if (isGuaranteed) {
      statusCaption.textContent =
        "You are now guaranteed to reach square 30 and earn £10 Champions Points, even without ladders.";
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
  diceEl.classList.add("spin");        // match .dice.spin in CSS
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

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.error || "Unable to roll.");
      return;
    }

    const {
      dice,
      fromPosition,
      toPosition,
      position,
      rollsUsed: newRollsUsed,
      rollsGranted: newRollsGranted,
      completed,
      reward
    } = data;

    // Update dice face slightly after the roll animation starts
    if (diceEl) {
      setTimeout(() => {
        diceEl.textContent = String(dice);
      }, 350);
    }

    currentPosition = position || 0;
    rollsUsed = newRollsUsed || 0;
    rollsGranted = newRollsGranted || 0;
    currentReward = reward ?? null;
    gameCompleted = !!completed;
    updateStatusUI();

    isAnimating = true;

    // Work out jumps for animation path
    const landed = toPosition;
    const isSnake = SNAKE_HEADS.has(landed);
    const isLadder = LADDER_BASES.has(landed);

    const finalPosition = landed;

    // The board movement should always follow the dice, then do jump
    await animateMove(fromPosition, landed, isSnake, isLadder, finalPosition);

    // short delay so dice + sound feel distinct from counter movement
    await new Promise((resolve) => setTimeout(resolve, 450));

    if (gameCompleted) {
      showCompletion(currentReward);
    }

    isAnimating = false;
  } catch (err) {
    console.error("Error on roll:", err);
    isAnimating = false;
  }
}

// ---- Board movement animation ----
function animateMove(fromPosition, landedPosition, isSnake, isLadder, finalPosition) {
  return new Promise((resolve) => {
    const normalEnd = Math.min(landedPosition, FINAL_SQUARE);
    const stepCount = normalEnd - fromPosition;
    const stepDuration = 160;

    let step = 0;

    moveSound.currentTime = 0;
    moveSound.play().catch(() => {});

    function stepSquares() {
      if (step >= stepCount) {
        finishNormalMove();
        return;
      }

      const intermediate = fromPosition + step + 1;
      placeCounter(intermediate);
      step++;

      setTimeout(stepSquares, stepDuration);
    }

    function finishNormalMove() {
      if (landedPosition > FINAL_SQUARE) {
        placeCounter(FINAL_SQUARE);
      }

      function endSequence() {
        placeCounter(finalPosition);
        resolve();
      }

      if (isSnake) {
        animateSnakeSlide(landedPosition, finalPosition).then(endSequence);
      } else if (isLadder) {
        animateLadderClimb(landedPosition, finalPosition).then(endSequence);
      } else {
        endSequence();
      }
    }

    if (stepCount > 0) {
      stepSquares();
    } else {
      finishNormalMove();
    }
  });
}

// ---- S1: curved snake slide ----
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
        inv * inv * start.x +
        2 * inv * t * ctrl.x +
        t * t * end.x;

      const y =
        inv * inv * start.y +
        2 * inv * t * ctrl.y +
        t * t * end.y;

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

// ---- L1: ladder climb (straight line) ----
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

// ---- Congratulations + confetti ----
function fireConfetti() {
  if (!confettiCanvas) return;

  confettiCanvas.innerHTML = "";
  confettiCanvas.classList.add("show");

  const colours = [
    "#f97316",
    "#22c55e",
    "#38bdf8",
    "#6366f1",
    "#e11d48",
    "#facc15",
    "#ffffff"
  ];

  const pieces = 140;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.animationDelay = Math.random() * 0.7 + "s";
    piece.style.opacity = String(0.7 + Math.random() * 0.3);
    piece.style.backgroundColor = colours[i % colours.length];
    confettiCanvas.appendChild(piece);
  }

  setTimeout(() => {
    confettiCanvas.classList.remove("show");
    confettiCanvas.innerHTML = "";
  }, 2200);
}

function showCompletion(reward) {
  winSound.currentTime = 0;
  winSound.play().catch(() => {});

  if (!winOverlay) winOverlay = document.getElementById("winOverlay");
  if (!winMessage) winMessage = document.getElementById("winMessage");
  if (!winCloseBtn) winCloseBtn = document.getElementById("winCloseBtn");
  if (!winOverlay) return;

  if (winMessage) {
    winMessage.textContent = reward
      ? `You have earned £${reward} Champions Points!`
      : "You have completed the board!";
  }

  // big confetti first, then show the modal ~2 seconds later
  fireConfetti();

  setTimeout(() => {
    winOverlay.classList.remove("hidden");
    winOverlay.style.display = "flex";
  }, 2000);

  function closeOverlay() {
    winOverlay.style.display = "none";
    winOverlay.classList.add("hidden");
  }

  winCloseBtn?.addEventListener("click", closeOverlay);
  winOverlay.addEventListener("click", (e) => {
    if (e.target === winOverlay) closeOverlay();
  });
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

  counterChoiceButtons.forEach((btn) => {
    const idx = parseInt(btn.dataset.theme || "1", 10);
    if (idx === saved) {
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => {
      counterChoiceButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      localStorage.setItem("counterTheme", String(idx));
      applyCounterTheme(idx);
    });
  });
}

// ---- Init ----
function init() {
  buildBoardGrid();
  initCounterChoice();
  loadState();
  if (rollBtn) {
    rollBtn.addEventListener("click", handleRoll);
  }

  window.addEventListener("resize", () => {
    buildBoardGrid();
    if (currentPosition > 0) {
      placeCounter(currentPosition);
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
