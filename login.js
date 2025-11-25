// login.js

const BACKEND_BASE_URL = "https://snakes-ladders-backend-github.onrender.com";
const REGISTER_ENDPOINT = `${BACKEND_BASE_URL}/player/register`;
const LOGIN_ENDPOINT = `${BACKEND_BASE_URL}/player/login`;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const fullNameInput = document.getElementById("fullNameInput");
  const swSelect = document.getElementById("swCodeSelect");
  const errorEl = document.getElementById("loginError");
  const helperEl = document.getElementById("loginHelperText");
  const submitBtn = document.getElementById("loginSubmitBtn");
  const modeButtons = document.querySelectorAll(".login-mode-btn");

  if (!form || !fullNameInput || !swSelect) {
    console.error("Login form elements not found – check index.html IDs.");
    return;
  }

  let currentMode = "login"; // 'login' | 'register'

  // ---------- MODE TOGGLE (login / register) ----------

  function setMode(mode) {
    currentMode = mode;

    modeButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });

    if (currentMode === "login") {
      submitBtn.textContent = "Login";
      if (helperEl) {
        helperEl.textContent =
          "Login: use the same entaingroup.com / lcroot login and SW area you registered with to continue your game.";
      }
    } else {
      submitBtn.textContent = "Register";
      if (helperEl) {
        helperEl.textContent =
          "Register: first time playing? Enter your entaingroup.com / lcroot login and SW area to create your game.";
      }
    }

    if (errorEl) errorEl.textContent = "";
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode || "login";
      setMode(mode);
    });
  });

  // start in login mode
  setMode("login");

  // ---------- SESSION STORAGE ----------

  function saveSession(email, area, displayName) {
    const session = {
      email,
      area,
      displayName,
    };
    try {
      localStorage.setItem("sl_session", JSON.stringify(session));
    } catch (err) {
      console.error("Failed to save session:", err);
    }
  }

  // ---------- HELPERS ----------

  function setSubmitting(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    if (isSubmitting) {
      submitBtn.textContent =
        currentMode === "login" ? "Logging in…" : "Registering…";
    } else {
      submitBtn.textContent =
        currentMode === "login" ? "Login" : "Register";
    }
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // ignore if no JSON
    }

    return { res, data };
  }

  // ---------- FORM SUBMIT ----------

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.textContent = "";

    const loginId = (fullNameInput.value || "").trim();
    const swCode = swSelect.value;

    if (!loginId) {
      if (errorEl) {
        errorEl.textContent =
          "Please enter your entaingroup.com / lcroot login.";
      }
      return;
    }

    if (!swCode) {
      if (errorEl) {
        errorEl.textContent = "Please select your SW area.";
      }
      return;
    }

    setSubmitting(true);

    try {
      const email = loginId; // we treat their login as email/ID
      const area = swCode;

      if (currentMode === "register") {
        // ----- REGISTER FLOW -----
        const { res, data } = await postJson(REGISTER_ENDPOINT, {
          email,
          area,
        });

        if (!res.ok) {
          let msg = `Unable to register (HTTP ${res.status}).`;
          if (data && data.error) msg = data.error;
          if (errorEl) errorEl.textContent = msg;
          return;
        }

        // successful register – tell them to now login
        if (helperEl) {
          helperEl.textContent =
            "Registration successful. Now use Player login with the same entaingroup.com / lcroot login and SW area to start or continue your game.";
        }
        if (errorEl) errorEl.textContent = "";

        const loginBtn = document.querySelector(
          '.login-mode-btn[data-mode="login"]'
        );
        if (loginBtn) {
          loginBtn.click();
        } else {
          setMode("login");
        }

        return;
      } else {
        // ----- LOGIN FLOW -----
        const { res, data } = await postJson(LOGIN_ENDPOINT, {
          email,
          area,
        });

        if (!res.ok) {
          let msg = `Unable to login (HTTP ${res.status}).`;
          if (data && data.error) msg = data.error;

          // enforce the “register first” style message
          if (
            res.status === 400 ||
            res.status === 404 ||
            (typeof msg === "string" &&
              /not\s*found|no\s*user|unknown|player/i.test(msg))
          ) {
            msg = "Incorrect login or you may need to register first.";
          }

          if (errorEl) errorEl.textContent = msg;
          return;
        }

        // Backend just says { success: true } – so we save what we know.
        saveSession(email, area, loginId);
        window.location.href = "game.html";
      }
    } catch (err) {
      console.error("Login network error", err);
      if (errorEl) {
        errorEl.textContent = "Network error – please try again.";
      }
    } finally {
      setSubmitting(false);
    }
  });
});
