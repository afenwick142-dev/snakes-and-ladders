// game.js
// Full game logic for Snakes & Ladders
// Handles rolls, movement, board animation, sounds, confetti

const API = "https://snakes-ladders-backend-github.onrender.com";

// Elements
const rollBtn = document.getElementById("rollBtn");
const rollsRemainingEl = document.getElementById("rollsRemaining");
const positionEl = document.getElementById("currentPosition");
const diceImg = document.getElementById("diceImage");

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
            alert(data.error || "Unable to roll.");
            return;
        }

        // Set dice image (1–6)
        diceImg.src = `dice${data.dice}.png`;

        animateMove(data.fromPosition, data.toPosition);

        rollsRemainingEl.textContent = data.availableRolls;
        positionEl.textContent = data.toPosition;

        if (data.completed) {
            setTimeout(() => showCompletion(data.reward), 1500);
        }

    } catch (err) {
        alert("Server error.");
    }
});

// --- MOVEMENT ANIMATION ---
function animateMove(from, to) {
    // Standard sound
    moveSound.play();

    // Ladder?
    if (to > from + 6) {
        ladderSound.play();
    }

    // Snake?
    if (to < from) {
        snakeSound.play();
    }

    // TODO: your existing counter animation stays the same
}

// --- COMPLETION SCREEN ---
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
