/* =========================
   Snakes & Ladders – game.js
   ========================= */

const API = "https://snakes-ladders-backend-github.onrender.com";

/* -----------------------------
   DOM: with resilient fallbacks
------------------------------*/
const userInfoEl = document.getElementById("userInfo") || document.getElementById("playerName");

const logoutBtn =
  document.getElementById("btnLogout") ||
  document.getElementById("logout") ||
  document.querySelector("[data-role='logout']");

let boardGridEl =
  document.getElementById("boardGrid") ||
  document.querySelector(".board-grid") ||
  document.querySelector(".board-overlay");

let counterEl =
  document.getElementById("counter") ||
  document.querySelector(".counter") ||
  document.querySelector(".board-counter");

const diceEl = document.getElementById("dice") || document.getElementById("diceValue");
const rollBtn = document.getElementById("btnRoll") || document.getElementById("rollBtn");

const statusPosition = document.getElementById("statusPosition");
const statusRollsUsed = document.getElementById("statusRollsUsed");
const statusRollsGranted = document.getElementById("statusRollsGranted");
const statusReward = document.getElementById("statusReward");

const statusPositionText = document.getElementById("statusPositionText");
const statusRollsUsedText = document.getElementById("statusRollsUsedText");
const statusRollsGrantedText = document.getElementById("statusRollsGrantedText");
const statusRewardText = document.getElementById("statusRewardText");
const statusCaption = document.getElementById("statusCaption");

// Win overlay (or auto-creates)
let winOverlay = document.getElementById("winOverlay");
let winMessage = document.getElementById("winMessage");
let winCloseBtn = document.getElementById("winCloseBtn");

// Counter choices
const counterChoiceButtons = document.querySelectorAll(".counter-choice");

/* -----------------------------
   Sounds (fail-safe)
------------------------------*/
const moveSound = new Audio("move.mp3");
const snakeSound = new Audio("snake.mp3");
const ladderSound = new Audio("ladder.mp3");
const winSound = new Audio("win.mp3");
const diceSound = new Audio("dice.mp3");

/* -----------------------------
   Player session
------------------------------*/
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

/* -----------------------------
   Board constants & helpers
------------------------------*/
const ROWS = 5, COLS = 6, FINAL_SQUARE = 30;
const JUMPS = { 3:22, 5:8, 11:26, 20:29, 17:4, 19:7, 27:1 }; // ladders up, snakes down
const SNAKE_HEADS = new Set([17,19,27]);
const cellsByPosition = {};

function ensureOverlayAndCounter() {
  // Create a grid overlay if missing (absolute overlay that tracks board)
  if (!boardGridEl) {
    const boardImg = document.querySelector(".board img, .board-image, .game-board img") || document.querySelector("img");
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

  // Create a counter if missing
  if (!counterEl) {
    counterEl = document.createElement("div");
    counterEl.id = "counter";
    counterEl.textContent = ""; // purely visual; styled circle
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
  boardGridEl.innerHTML = boardGridEl.innerHTML; // keep counter if existed
  // ensure counter re-appended
  if (!document.getElementById("counter")) boardGridEl.appendChild(counterEl);

  // rebuild 30 cells
  const existingCounter = counterEl;
  boardGridEl.innerHTML = "";
  boardGridEl.appendChild(existingCounter);

  const allCells = [];
  for (let i = 0; i < FINAL_SQUARE; i++) {
    const c = document.createElement("div");
    c.className = "board-cell";
    Object.assign(c.style, {
      position: "absolute",
    });
    boardGridEl.appendChild(c);
    allCells.push(c);
  }

  // Size the grid based on the overlay element box
  const rect = boardGridEl.getBoundingClientRect();
  const cellW = rect.width / COLS;
  const cellH = rect.height / ROWS;

  // Position absolute cells to form a grid
  let pos = 1;
  for (let rFromBottom = 0; rFromBottom < ROWS; rFromBottom++) {
    const realRowIndex = ROWS - 1 - rFromBottom; // 4..0
    const leftToRight = rFromBottom % 2 === 0;   // bottom row L->R, next R->L, etc.

    for (let c = 0; c < COLS; c++) {
      const colIndex = leftToRight ? c : COLS - 1 - c;
      const x = colIndex * cellW;
      const y = realRowIndex * cellH;

      const cell = allCells[realRowIndex * COLS + c];
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

/* -----------------------------
   State + UI
------------------------------*/
let currentPosition = 0;
let rollsUsed = 0;
let rollsGranted = 0;
let currentReward = null;
let gameCompleted = false;
let isAnimating = false;

function updateStatusUI() {
  const remaining = Math.max(0, rollsGranted - rollsUsed);

  statusPosition && (statusPosition.textContent = String(currentPosition));
  statusRollsUsed && (statusRollsUsed.textContent = String(rollsUsed));
  statusRollsGranted && (statusRollsGranted.textContent = String(rollsGranted));
  statusReward && (statusReward.textContent = currentReward ? `£${currentReward}` : "—");

  statusPositionText && (statusPositionText.textContent = `Position: ${currentPosition} / ${FINAL_SQUARE}`);
  statusRollsUsedText && (statusRollsUsedText.textContent = `Rolls used: ${rollsUsed}`);
  statusRollsGrantedText && (statusRollsGrantedText.textContent = `Rolls granted: ${rollsGranted}`);
  statusRewardText && (statusRewardText.textContent = `Reward: ${currentReward ? "£"+currentReward : "—"}`);

  if (statusCaption) {
    if (gameCompleted) statusCaption.textContent = "Game complete – well done!";
    else if (remaining <= 0) statusCaption.textContent = "No rolls remaining – speak to your manager to get more.";
    else statusCaption.textContent = `You have ${remaining} roll(s) remaining.`;
  }
}

/* -----------------------------
   Load state
------------------------------*/
async function loadState() {
  try {
    const res = await fetch(`${API}/player/state?email=${encodeURIComponent(email)}&area=${encodeURIComponent(area)}`);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Unable to load player state."); window.location.href = "index.html"; return;
    }
    currentPosition = data.position || 0;
    rollsUsed = data.rollsUsed || 0;
    rollsGranted = data.rollsGranted || 0;
    currentReward = data.reward ?? null;
    gameCompleted = !!data.completed;

    updateStatusUI(); placeCounter(currentPosition);
    if (gameCompleted) showCompletion(currentReward);
  } catch (e) {
    console.error(e);
  }
}

/* -----------------------------
   Dice planner (≤ 6 rolls)
   - No skips: animation always steps square-by-square
   - Tries to hit a snake early sometimes (fun!), but avoids snake heads late
------------------------------*/
function choosePlannedDice(pos, rollsLeft) {
  const dist = FINAL_SQUARE - pos;

  // Last roll: aim to finish, avoid landing on a snake head if possible
  if (rollsLeft === 1) {
    let d = Math.max(1, Math.min(6, dist));
    if (SNAKE_HEADS.has(pos + d)) {
      // try nearby values that still get us close
      for (let alt of [d-1, d-2, d-3, d+1, d+2, d+3]) {
        if (alt >= 1 && alt <= 6 && !SNAKE_HEADS.has(pos + alt)) { d = alt; break; }
      }
    }
    return d;
  }

  // Early rolls: 30% chance to purposefully land a snake head if we can still finish afterwards
  if (Math.random() < 0.3) {
    for (const head of [17,19,27]) {
      const d = head - pos;
      if (d >= 1 && d <= 6) {
        const tail = JUMPS[head];
        const remainingAfter = FINAL_SQUARE - tail;
        const maxReach = 6*(rollsLeft-1);
        if (remainingAfter <= maxReach) return d; // safe to hit snake now
      }
    }
  }

  // Default: keep progress but leave wiggle room
  // Aim so that (dist - d) can be done in (rollsLeft-1) rolls: choose d close to dist - (rollsLeft-1)
  let target = Math.max(1, Math.min(6, dist - (rollsLeft - 1)));
  // Avoid snake heads when we are getting close (<=2 rolls left)
  if (rollsLeft <= 2 && SNAKE_HEADS.has(pos + target)) {
    for (let alt of [target-1, target+1, target-2, target+2, target-3, target+3]) {
      if (alt >= 1 && alt <= 6 && !SNAKE_HEADS.has(pos + alt)) { target = alt; break; }
    }
  }
  return target;
}

function animateDiceTo(value) {
  if (!diceEl) return;
  // quick rolling animation then show final face
  let t = 0;
  const frames = 10;
  const interval = setInterval(() => {
    diceEl.textContent = String(1 + Math.floor(Math.random()*6));
    t++;
    if (t >= frames) {
      clearInterval(interval);
      diceEl.textContent = String(value);
    }
  }, 45);
}

/* -----------------------------
   Roll sequence
------------------------------*/
async function handleRoll() {
  if (isAnimating || gameCompleted) return;

  try {
    // Plan a dice (≤ 6 rolls total)
    const remainingRollsBudget = Math.max(1, 6 - rollsUsed);
    const plannedDice = choosePlannedDice(currentPosition, remainingRollsBudget);

    diceSound.currentTime = 0; diceSound.play().catch(()=>{});
    animateDiceTo(plannedDice);

    // Send to backend – server still does true dice + jumps,
    // but we pass a hint to keep UX synced (server ignores unknown fields)
    const res = await fetch(`${API}/player/roll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, area, planned: plannedDice })
    });

    const data = await res.json();
    if (!res.ok) { alert(data.error || "Unable to roll right now."); return; }

    const fromPosition = data.fromPosition;
    const toPosition = data.position;
    const diceValue = data.dice; // actual server dice

    // If server's dice differs too much, show that instead after anim
    setTimeout(()=>{ if (diceEl) diceEl.textContent = String(diceValue); }, 480);

    // Recompute flags
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
    if (gameCompleted) showCompletion(currentReward);
  } catch (err) {
    console.error("Roll error:", err); alert("Server error – please try again.");
  }
}

rollBtn?.addEventListener("click", handleRoll);

/* -----------------------------
   Movement animation (step-by-step)
------------------------------*/
function animateMove(fromPosition, normalEnd, finalPosition, isSnake, isLadder) {
  return new Promise((resolve) => {
    isAnimating = true;

    const path = [];
    for (let p = fromPosition + 1; p <= normalEnd; p++) path.push({ pos: p, type:"move" });
    if (finalPosition !== normalEnd)
      path.push({ pos: finalPosition, type: isSnake ? "snake" : isLadder ? "ladder" : "move" });

    if (path.length === 0) { isAnimating = false; resolve(); return; }

    let i = 0;
    (function step() {
      const s = path[i];
      placeCounter(s.pos);

      if (s.type === "snake") { snakeSound.currentTime = 0; snakeSound.play().catch(()=>{}); }
      else if (s.type === "ladder") { ladderSound.currentTime = 0; ladderSound.play().catch(()=>{}); }
      else { moveSound.currentTime = 0; moveSound.play().catch(()=>{}); }

      i++;
      if (i < path.length) setTimeout(step, s.type === "move" ? 340 : 600);
      else { isAnimating = false; resolve(); }
    })();
  });
}

/* -----------------------------
   Congratulations (bigger + fireworks)
------------------------------*/
function ensureWinOverlay() {
  if (winOverlay) return;
  winOverlay = document.createElement("div");
  winOverlay.id = "winOverlay";
  Object.assign(winOverlay.style, {
    position: "fixed", inset: "0", background: "rgba(10,13,24,0.6)",
    display: "none", alignItems: "center", justifyContent: "center",
    zIndex: "9999", backdropFilter: "blur(2px)"
  });
  const card = document.createElement("div");
  card.className = "win-modal";
  Object.assign(card.style, {
    background: "linear-gradient(180deg,#15223b,#0f1a34)",
    color: "white", borderRadius: "24px", padding: "32px 38px",
    width: "min(90vw, 560px)", boxShadow: "0 24px 64px rgba(0,0,0,.55)",
    textAlign: "center", animation: "winPop .5s ease-out"
  });
  const h = document.createElement("h2"); h.textContent = "Congratulations!";
  Object.assign(h.style, { fontSize: "32px", margin: "0 0 10px" });
  winMessage = document.createElement("div");
  winMessage.id = "winMessage";
  Object.assign(winMessage.style, { fontSize: "20px", opacity: ".95", marginBottom: "18px" });
  winMessage.textContent = "You have completed the board!";
  const btn = document.createElement("button");
  btn.id = "winCloseBtn"; btn.textContent = "Close";
  Object.assign(btn.style, {
    fontSize: "18px", padding: "10px 20px", borderRadius: "12px",
    border: "0", background: "#7C3AED", color: "#fff", cursor: "pointer",
    boxShadow: "0 10px 24px rgba(124,58,237,.35)"
  });
  btn.addEventListener("click", ()=>{ winOverlay.style.display="none"; });
  card.appendChild(h); card.appendChild(winMessage); card.appendChild(btn); winOverlay.appendChild(card);
  document.body.appendChild(winOverlay);

  // keyframes once
  if (!document.getElementById("win-pop-keyframes")) {
    const style = document.createElement("style"); style.id = "win-pop-keyframes";
    style.textContent = `@keyframes winPop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.05);opacity:1}100%{transform:scale(1);opacity:1}}`;
    document.head.appendChild(style);
  }
}

function fireConfetti() {
  function burst() {
    confetti({ particleCount: 320, spread: 120, startVelocity: 45, origin: { y:.45 }, ticks: 240 });
    setTimeout(()=>confetti({ particleCount: 200, spread: 70, origin:{x:.2,y:.5} }), 220);
    setTimeout(()=>confetti({ particleCount: 200, spread: 70, origin:{x:.8,y:.5} }), 220);
  }
  if (typeof confetti === "function") { burst(); return; }
  // load on the fly
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js";
  s.onload = burst;
  document.head.appendChild(s);
}

function showCompletion(reward) {
  winSound.currentTime = 0; winSound.play().catch(()=>{});
  ensureWinOverlay();
  fireConfetti();

  if (winMessage) {
    winMessage.textContent = reward ? `You have earned £${reward} Champions Points!` : "You have completed the board!";
    winMessage.style.fontSize = "22px";
  }
  winOverlay.style.display = "flex";
}

/* -----------------------------
   Counter style sync
------------------------------*/
function applyCounterTheme(index) {
  if (!counterEl) return;
  for (let i = 1; i <= 6; i++) counterEl.classList.remove(`counter-theme-${i}`);
  if (index >= 1 && index <= 6) counterEl.classList.add(`counter-theme-${index}`);
}

function initCounterChoice() {
  const saved = parseInt(localStorage.getItem("counterTheme") || "1", 10);
  applyCounterTheme(saved);
  counterChoiceButtons.forEach((b, i) => {
    if (i+1 === saved) b.classList.add("counter-choice-active");
    b.addEventListener("click", () => {
      counterChoiceButtons.forEach(x=>x.classList.remove("counter-choice-active"));
      b.classList.add("counter-choice-active");
      localStorage.setItem("counterTheme", String(i+1));
      applyCounterTheme(i+1);
      // re-place in case size changed
      placeCounter(currentPosition);
    });
  });
}

/* -----------------------------
   Init
------------------------------*/
buildBoardGrid();
initCounterChoice();
loadState();
window.addEventListener("resize", ()=>placeCounter(currentPosition));
