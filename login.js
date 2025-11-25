// login.js
// Player Register + Login for SW Snakes & Ladders
// Works with the styled index.html (fullNameInput + swCodeSelect form)

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

// --- MODE TOGGLING (PLAYER LOGIN / REGISTER) ---
function setMode(mode) {
  currentMode = mode;

  // Toggle button styling
  modeButtons.forEach((btn) => {
    if (btn.dataset.mode === mode) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update button text + helper copy
  if (currentMode === "login") {
    loginSubmitBtn.textContent = "Login";
    if (loginHelperText) {
      loginHelperText.textContent =
        "Login: use the same entaingroup.com / lcroot login and SW area you registered with to continue your game.";
    }
  } else {
    loginSubmitBtn.textContent = "Register";
    if (loginHelperText) {
      loginHelperText.textContent =
        "Register: new players should register once with their entaingroup.com / lcroot login and SW area before using Player login.";
    }
  }

  // Clear messages
  if (loginError) {
    loginError.textContent = "";
  }
}

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode === "register" ? "register" : "login";
    setMode(mode);
  });
});

// Ensure default state matches the active button in the HTML
const initiallyActive = document.querySelector(".login-mode-btn.active");
if (initiallyActive && initiallyActive.dataset.mode) {
  currentMode = initiallyActive.dataset.mode;
} else {
  currentMode = "login";
}
setMode(currentMode);

// --- HELPERS ---
function normaliseEmailOrLogin(value) {
  return (value || "").trim();
}

function normaliseArea(value) {
  return (value || "").trim().toUpperCase();
}

function showError(message) {
  if (loginError) {
    loginError.textContent = message || "";
  }
}

// --- FORM SUBMIT HANDLER ---
loginForm?.addEventListener("submit", async (evt) => {
  evt.preventDefault();
  showError("");

  const emailRaw = fullNameInput.value;
  const areaRaw = swCodeSelect.value;

  const email = normaliseEmailOrLogin(emailRaw);
  const area = normaliseArea(areaRaw);

  if (!email || !area) {
    showError("Please enter your entaingroup.com / lcroot login and select your SW area.");
    return;
  }

  // Decide endpoint based on mode
  const endpoint =
    currentMode === "register" ? "/player/register" : "/player/login";

  try {
    const res = await fetch(`${API}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, area }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      // ignore JSON parse errors, we'll fall back to generic messages
    }

    if (!res.ok || data.success === false) {
      const msg =
        (data && data.error) ||
        (currentMode === "register"
          ? "Registration failed."
          : "Login failed.");
      showError(msg);
      return;
    }

    if (currentMode === "register") {
      // Registration successful – do NOT go straight into the game.
      // Ask the player to switch to Player login as per your requirement.
      showError(
        "Registration successful. Now select Player login and use the same details to continue your game."
      );
      setMode("login");
      return;
    }

    // LOGIN SUCCESS
    localStorage.setItem("playerEmail", email);
    localStorage.setItem("playerArea", area);

    window.location.href = "game.html";
  } catch (err) {
    console.error("Login error:", err);
    showError("Server error – please try again.");
  }
});
