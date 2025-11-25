// game.js
// Full game logic for Snakes & Ladders
// Handles rolls, movement, board animation, sounds, confetti

const API = "https://snakes-ladders-backend-github.onrender.com";

// Elements
const rollBtn = document.getElementById("rollBtn");
const rollsRemainingEl = document.getElementById("rollsRemaining");
const positionEl = document.getElementById("currentPosition");
const diceImg = document.getElementById("diceImage");

// Header user info + logout
const userInfoEl = document.getElementById("userInfo");
const logoutBtn = document.getElementById("btnLogout");

// Sounds
const moveSound = new Audio("move.mp3");
const snakeSound = new Audio("snake.mp3");
const ladderSound = new Audio("ladder.mp3");
const winSound = new Audio("win.mp3");

// Player data
let email = localStorage.getItem("playerEmail");
let area = localStorage.getItem("playerArea");

// Redirect if not logged in
if (!email || !area) {
    window.location.href = "index.html";
}

// Populate header pill with user info
if (userInfoEl) {
    userInfoEl.textContent = `${email} · ${area}`;
    userInfoEl.title = `${email} (${area})`;
}

// Logout handler
logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("playerEmail");
    localStorage.removeItem("playerArea");
    window.location.href = "index.html";
});

// --- LOAD PLAYER STATE ---
async function loadState() {
    try {
        const res = await fetch(`${API}/player/state?email=${email}&area=${area}`);
        const data = await res.json();

        if (!res.ok) {
            alert("Error: " + data.error);
            window.location.href = "index.html";
            return;
        }

        rollsRemainingEl.textContent = data.availableRolls;
        positionEl.textContent = data.position;

        if (data.completed) {
            showCompletion(data.reward);
        }

    } catch (err) {
        console.error(err);
    }
}

loadState();

// --- ROLL ---
rollBtn.addEventListener("click", async () => {
    try {
        const res = await fetch(`${API}/player/roll`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, area })
        });

        const data = await res.json();

        if (!res.ok) {
            alert("Error: " + data.error);
            return;
        }

        const roll = data.roll;
        const newPosition = data.position;
        const hitSnake = data.hitSnake;
        const hitLadder = data.hitLadder;
        const completed = data.completed;

        rollsRemainingEl.textContent = data.availableRolls;
        animateMove(roll, newPosition, hitSnake, hitLadder, completed, data.reward);

    } catch (err) {
        console.error(err);
        alert("Server error, please try again.");
    }
});

// --- MOVEMENT + ANIMATION (rest of your existing code unchanged) ---
function animateMove(roll, newPosition, hitSnake, hitLadder, completed, reward) {
    // ... your existing animateMove implementation ...
    // (keep everything from here down exactly as in your current file)
}

function showCompletion(reward) {
    winSound.play();

    // BIG confetti
    confetti({
        particleCount: 450,
        spread: 120,
        origin: { y: 0.4 }
    });

    setTimeout(() => {
        alert(`Congratulations! You have finished and earned £${reward} Champions Points!`);
    }, 1500);
}
