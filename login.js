// login.js
// Player Register + Login
// Uses your backend deployed on Render

const API = "https://snakes-ladders-backend-github.onrender.com";

// Elements
const loginBtn = document.getElementById("playerLoginBtn");
const registerBtn = document.getElementById("playerRegisterBtn");
const emailInput = document.getElementById("loginEmail");
const areaSelect = document.getElementById("loginArea");
const loginError = document.getElementById("loginError");

// --- REGISTER ---
registerBtn?.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const area = areaSelect.value.trim();

    if (!email || !area) {
        loginError.textContent = "Email and area are required.";
        return;
    }

    try {
        const res = await fetch(`${API}/player/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, area })
        });

        if (!res.ok) {
            loginError.textContent = "Unable to register (HTTP " + res.status + ")";
            return;
        }

        loginError.textContent = "Registered successfully. Please login.";
    } catch (err) {
        loginError.textContent = "Server error.";
    }
});

// --- LOGIN ---
loginBtn?.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const area = areaSelect.value.trim();

    loginError.textContent = "";

    try {
        const res = await fetch(`${API}/player/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, area })
        });

        const data = await res.json();

        if (!res.ok) {
            loginError.textContent = data.error || "Login failed.";
            return;
        }

        // Save to localStorage
        localStorage.setItem("playerEmail", email);
        localStorage.setItem("playerArea", area);

        window.location.href = "game.html";
    } catch (err) {
        loginError.textContent = "Server error.";
    }
});
