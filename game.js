// game.js - Snakes & Ladders front-end

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

// Counter style buttons
const counterChoiceButtons = document.querySelectorAll(".counter-choice");

// Confetti overlay container
const confettiContainer = document.getElementById("confetti");

// Winner overlay
let winOverlay = document.getElementById("winOverlay");
let winMessage = document.getElementById("winMessage");
let winCloseBtn = document.getElementById("winCloseBtn");

// ---- Sounds ----
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

// Jumps (snakes & ladders)
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

// Position -> cell element
const cellsByPosition = {};

// ---- Utils ----
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ensure board grid & counter exist and are correctly positioned
function ensureOverlayAndCounter() {
  if (!boardGridEl) {
    const container =
      document.querySelector(".board-container") || document.body;
    boardGridEl = document.createElement("div");
    boardGridEl.id = "boardGrid";
    boardGridEl.className = "board-grid";
    container.appendChild(boardGridEl);
  }
  if (!counterEl) {
    counterEl = document.createElement("div");
    counterEl.id = "counter";
    counterEl.className = "counter";
    boardGridEl.appendChild(counterEl);
  }
  counterEl.style.position = "absolute";
  counterEl.style.zIndex = "10";
}

// Build logical 5x6 grid overlay
function buildBoardGrid() {
  ensureOverlayAndCounter();

  const currentCounter = counterEl;
  boardGridEl.innerHTML = "";
  boardGridEl.appendChild(currentCounter);

  const rect = boardGridEl.getBoundingClientRect();
  const cellW = rect.width / COLS;
  const cellH = rect.height / ROWS;

  let pos = 1;
  for (let rowFromBottom = 0; rowFromBottom < ROWS; rowFromBottom++) {
    const visualRow = ROWS - 1 - rowFromBottom; // top -> bottom
    const leftToRight = rowFromBottom % 2 === 0; // 1st,3rd,5th from bottom

    for (let col = 0; col < COLS; col++) {
      const visualCol = leftToRight ? col : COLS - 1 - col;
      const x = visualCol * cellW;
      const y = visualRow * cellH;

      const cell = document.createElement("div");
      cell.className = "board-cell";
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

function getCellCenter(position) {
  const cell = cellsByPosition[position];
  if (!cell || !boardGridEl) return { x: 0, y: 0 };
  const gridRect = boardGridEl.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const x = cellRect.left + cellRect.width / 2 - gridRect.left;
  const y = cellRect.top + cellRect.height / 2 - gridRect.top;
  return { x, y };
}

function placeCounter(position) {
  if (!counterEl || !boardGridEl || position <= 0) return;
  const { x, y } = getCellCenter(position);
  counterEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  counterEl.classList.remove("hidden");
}

// ---- Game state ----
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

  // Guaranteed to finish if you can move at least 1 each roll, even with no ladders
  const isGuaranteed =
    !gameCompleted && squaresLeft > 0 && remaining >= squaresLeft;

  const potentialReward =
    currentReward != null ? currentReward : isGuaranteed ? 10 : null;

  if (statusPosition) statusPosition.textContent = String(currentPosition);
  if (statusRollsUsed) statusRollsUsed.textContent = String(rollsUsed);
  if (statusRollsGranted) statusRollsGranted.textContent = String(rollsGranted);
  if (statusReward)
    statusReward.textContent = potentialReward ? `£${potentialReward}` : "—";

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
        "You are now guaranteed to reach square 30 and earn £10 Champions Points.";
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
  // Uses .dice.spin and @keyframes spinDice from style.css
  diceEl.classList.add("spin");
  setTimeout(() => diceEl.classList.remove("spin"), 600);
}

// ---- Movement animations ----
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
        // Now do snake/ladder jump if needed
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
      // no intermediate squares
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

// ---- Confetti ----
function fireConfetti() {
  if (!confettiContainer) return;

  confettiContainer.innerHTML = "";
  confettiContainer.classList.add("show");

  const colours = [
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
    piece.style.backgroundColor = colours[i % colours.length];
    confettiContainer.appendChild(piece);
  }

  setTimeout(() => {
    confettiContainer.classList.remove("show");
    confettiContainer.innerHTML = "";
  }, 2300);
}

// ---- Completion overlay ----
function showCompletion(reward) {
  if (!winOverlay) winOverlay = document.getElementById("winOverlay");
  if (!winMessage) winMessage = document.getElementById("winMessage");
  if (!winCloseBtn) winCloseBtn = document.getElementById("winCloseBtn");
  if (!winOverlay) return;

  if (winMessage) {
    winMessage.textContent = reward
      ? `You have earned £${reward} Champions Points!`
      : "You have completed the board!";
  }

  // Confetti for ~2 seconds first
  fireConfetti();

  // Then show the overlay + play sound
  setTimeout(() => {
    winSound.currentTime = 0;
    winSound.play().catch(() => {});

    winOverlay.classList.remove("hidden");
    winOverlay.style.display = "flex";

    function closeOverlay() {
      winOverlay.style.display = "none";
      winOverlay.classList.add("hidden");
    }

    winCloseBtn?.addEventListener("click", closeOverlay);
    winOverlay.addEventListener("click", (e) => {
      if (e.target === winOverlay) closeOverlay();
    });
  }, 2000);
}

// ---- Dice roll handler ----
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
      alert(data.error || "Unable to roll right now.");
      return;
    }

    const diceValue = data.dice;
    const fromPosition = data.fromPosition;
    const toPosition = data.position;

    if (diceEl) {
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

    // Small delay so dice + sound feel separate from movement
    await sleep(650);

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
    if (idx === saved) btn.classList.add("active");

    btn.addEventListener("click", () => {
      counterChoiceButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      localStorage.setItem("counterTheme", String(idx));
      applyCounterTheme(idx);
      placeCounter(currentPosition || 1);
    });
  });
}

// ---- Init ----
function initGame() {
  buildBoardGrid();
  initCounterChoice();
  loadState();

  rollBtn?.addEventListener("click", handleRoll);

  window.addEventListener("resize", () => {
    buildBoardGrid();
    if (currentPosition > 0) placeCounter(currentPosition);
  });
}

document.addEventListener("DOMContentLoaded", initGame);
