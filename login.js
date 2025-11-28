// login.js
// Player Register + Login for SW Snakes & Ladders

const API = "https://snakes-ladders-backend-github.onrender.com";

// --- ELEMENTS ---
const loginForm = document.getElementById("loginForm");
const modeButtons = document.querySelectorAll(".login-mode-btn");
const fullNameInput = document.getElementById("fullNameInput");
const swCodeSelect = document.getElementById("swCodeSelect");
const loginError = document.getElementById("loginError");
const loginHelperText = document.getElementById("loginHelperText");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");

// current mode: "login" | "register"
let currentMode = "login";

// --- HELPERS ---
function showError(msg) {
  if (!loginError) return;
  loginError.textContent = msg || "";
}

function setMode(mode) {
  currentMode = mode;

  // Toggle active button styling
  modeButtons.forEach((btn) => {
    const btnMode = btn.dataset.mode;
    btn.classList.toggle("active", btnMode === mode);
  });

  // Clear any previous error
  showError("");

  if (!loginHelperText || !loginSubmitBtn) return;

  if (mode === "login") {
    loginSubmitBtn.textContent = "Login";
    loginHelperText.textContent =
      "Login: use the same entaingroup.com / lcroot login and SW area you registered with to continue your game.";
  } else {
    loginSubmitBtn.textContent = "Register";
    loginHelperText.textContent =
      "Register: create your player record for this SW area, then switch to Player login to continue your game.";
  }
}

// --- INITIAL MODE ---
setMode("login");

// --- TOGGLE BUTTON HANDLERS ---
modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode || "login";
    setMode(mode);
  });
});

// --- FORM SUBMIT ---
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");

  const rawLogin = (fullNameInput?.value || "").trim();
  const area = (swCodeSelect?.value || "").trim();

  if (!rawLogin) {
    showError("Please enter your entaingroup.com / lcroot login.");
    return;
  }

  if (!area) {
    showError("Please select your SW area.");
    return;
  }

  // Backend treats this as a generic identifier (normalised to lowercase)
  const email = rawLogin.toLowerCase();

  const endpoint =
    currentMode === "register" ? "/player/register" : "/player/login";

  try {
    if (loginSubmitBtn) loginSubmitBtn.disabled = true;

    const res = await fetch(`${API}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, area }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      // ignore JSON parse errors, will fall back to generic error
    }

    if (!res.ok || !data.success) {
      const action =
        currentMode === "register" ? "register right now." : "log in right now.";
      const msg = data.error || `Unable to ${action}`;
      showError(msg);
      if (loginSubmitBtn) loginSubmitBtn.disabled = false;
      return;
    }

    if (currentMode === "register") {
      // Registration successful – stay on login page as requested
      showError(
        "Registration successful. Now select Player login and use the same details to continue your game."
      );
      setMode("login");
      if (loginSubmitBtn) loginSubmitBtn.disabled = false;
      return;
    }

    // LOGIN SUCCESS
    localStorage.setItem("playerEmail", email);
    localStorage.setItem("playerArea", area);

    window.location.href = "game.html";
  } catch (err) {
    console.error("Login error:", err);
    showError("Server error – please try again.");
    if (loginSubmitBtn) loginSubmitBtn.disabled = false;
  }
});
