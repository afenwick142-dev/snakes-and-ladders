// game.js
// Front-end logic for SW Snakes & Ladders
// - Uses backend at /player/* and /area/*
// - Animates the counter across the board, including snakes & ladders
// - Shows big congratulations modal + confetti
// - Dice uses GIF + sound, then shows the final number

const API = "https://snakes-ladders-backend-github.onrender.com";

// ---- DOM references ----
const userInfoEl = document.getElementById("userInfo");
const logoutBtn = document.getElementById("btnLogout");

let boardGridEl = document.getElementById("boardGrid");
let counterEl = document.getElementById("counter");

const diceEl = document.getElementById("dice");
const diceGifEl = document.getElementById("diceGif");
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
  21: 9, // NEW snake head at 21 down to 9
  27: 1,
};

const SNAKE_HEADS = new Set([17, 19, 21, 27]);
const LADDER_BASES = new Set([3, 5, 11, 20]);

// map from position -> cell element
const cellsByPosition = {};

// ---- Ensure overlay + counter exist ----
function ensureOverlayAndCounter() {
  if (!boardGridEl) {
    const boardContainer =
      document.querySelector(".board-container") || document.body;
    const grid = document.createElement("div");
    grid.id = "boardGrid";
    grid.className = "board-grid";
    boardContainer.appendChild(grid);
    boardGridEl = grid;
  }

  if (!counterEl) {
    const counter = document.createElement("div");
    counter.id = "counter";
    counter.className = "counter hidden";
    const boardContainer =
      document.querySelector(".board-container") || document.body;
    boardContainer.appendChild(counter);
    counterEl = counter;
  }

  if (!confettiCanvas) {
    const confetti = document.createElement("div");
    confetti.id = "confetti";
    confetti.className = "confetti";
    document.body.appendChild(confetti);
  }

  if (!winOverlay) {
    const overlay = document.createElement("div");
    overlay.id = "winOverlay";
    overlay.className = "win-overlay hidden";
    overlay.innerHTML = `
      <div class="win-card">
        <h2>Congratulations!</h2>
        <p id="winMessage"></p>
        <button id="winCloseBtn" class="btn btn-secondary">Close</button>
      </div>
    `;
    document.body.appendChild(overlay);
    winOverlay = overlay;
    winMessage = document.getElementById("winMessage");
    winCloseBtn = document.getElementById("winCloseBtn");
  }
}

ensureOverlayAndCounter();

// ---- Build invisible board grid ----
function buildBoardGrid() {
  if (!boardGridEl) return;
  boardGridEl.innerHTML = "";

  let position = 0;
  for (let row = ROWS; row >= 1; row--) {
    const isEvenRow = (ROWS - row) % 2 === 1;
    for (let col = 1; col <= COLS; col++) {
      position++;
      const actualCol = isEvenRow ? COLS - col + 1 : col;
      const cell = document.createElement("div");
      cell.className = "board-cell";
      cell.dataset.position = String(position);
      boardGridEl.appendChild(cell);
      cellsByPosition[position] = cell;
    }
  }
}

buildBoardGrid();

// ---- Counter placement ----
function getCellCenter(position) {
  const cell = cellsByPosition[position];
  const boardRect = boardGridEl.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const x = cellRect.left + cellRect.width / 2 - boardRect.left;
  const y = cellRect.top + cellRect.height / 2 - boardRect.top;
  return { x, y };
}

function placeCounter(position) {
  if (!counterEl || !boardGridEl) return;
  counterEl.classList.remove("hidden");

  const { x, y } = getCellCenter(position);
  counterEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
}

// ---- Counter styles ----
let selectedCounterThemeIndex = 0;

function updateCounterTheme() {
  if (!counterEl) return;
  counterEl.className = `counter counter-theme-${selectedCounterThemeIndex + 1}`;
}

counterChoiceButtons.forEach((btn, index) => {
  btn.addEventListener("click", () => {
    counterChoiceButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedCounterThemeIndex = index;
    updateCounterTheme();
    if (currentPosition > 0) {
      placeCounter(currentPosition);
    }
  });
});

// default counter theme
if (counterChoiceButtons[0]) {
  counterChoiceButtons[0].classList.add("active");
  selectedCounterThemeIndex = 0;
  updateCounterTheme();
}

// ---- Status state ----
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

// ---- Dice animation helpers ----
function startDiceAnimation() {
  try {
    diceSound.currentTime = 0;
    diceSound.play().catch(() => {});
  } catch {
    // ignore
  }

  if (diceGifEl) {
    diceGifEl.classList.remove("hidden");
  }

  if (diceEl) {
    diceEl.classList.add("spin");
    diceEl.textContent = "";
  }
}

function stopDiceAnimation(finalValue) {
  if (diceGifEl) {
    diceGifEl.classList.add("hidden");
  }

  if (diceEl) {
    diceEl.classList.remove("spin");
    diceEl.textContent =
      finalValue !== undefined && finalValue !== null ? String(finalValue) : "–";
  }
}

// ---- Roll button handler ----
async function handleRoll() {
  if (gameCompleted) return;

  startDiceAnimation();

  try {
    const res = await fetch(`${API}/player/roll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, area }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      stopDiceAnimation(null);
      alert(data.error || "Unable to roll right now.");
      return;
    }

    const diceValue = data.dice;
    const fromPosition = data.fromPosition;
    const toPosition = data.position;

    // let the GIF spin briefly, then show the number
    setTimeout(() => {
      stopDiceAnimation(diceValue);
    }, 350);

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
    stopDiceAnimation(null);
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

      const pos = pathSquares[index];
      placeCounter(pos);
      moveSound.currentTime = 0;
      moveSound.play().catch(() => {});
      index++;
      setTimeout(stepSquares, 150);
    }

    function endSequence() {
      placeCounter(finalPosition);
      resolve();
    }

    stepSquares();
  });
}

// ---- Confetti + completion ----
function launchConfetti() {
  const container = document.getElementById("confetti");
  if (!container) return;

  container.innerHTML = "";
  container.classList.add("show");

  const colors = ["#f97316", "#22c55e", "#38bdf8", "#6366f1", "#e11d48", "#facc15"];

  const pieces = 120;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = Math.random() * 0.5 + "s";
    container.appendChild(piece);
  }

  setTimeout(() => {
    container.classList.remove("show");
    container.innerHTML = "";
  }, 2500);
}

function showCompletion(reward) {
  try {
    winSound.currentTime = 0;
    winSound.play().catch(() => {});
  } catch {
    // ignore
  }
  launchConfetti();

  if (winOverlay) {
    winOverlay.classList.remove("hidden");
  }
  if (winMessage) {
    const rewardText =
      reward === 25
        ? "£25 Champions Points"
        : reward === 10
        ? "£10 Champions Points"
        : "your Champions Points prize";
    winMessage.textContent = `You reached square 30! You’ve secured ${rewardText}.`;
  }

  winCloseBtn?.addEventListener("click", () => {
    if (winOverlay) winOverlay.classList.add("hidden");
  });
}

// ---- Initial load ----
loadState();
