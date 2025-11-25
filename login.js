// -----------------------------
// CORRECT BACKEND URL
// -----------------------------
const BACKEND_BASE_URL = "https://snakes-ladders-backend-github.onrender.com";

// Correct endpoints based on backend server.js
const REGISTER_ENDPOINT = `${BACKEND_BASE_URL}/player/register`;
const LOGIN_ENDPOINT = `${BACKEND_BASE_URL}/player/login`;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const fullNameInput = document.getElementById('fullNameInput');
  const swSelect = document.getElementById('swCodeSelect');
  const errorEl = document.getElementById('loginError');
  const helperEl = document.getElementById('loginHelperText');
  const submitBtn = document.getElementById('loginSubmitBtn');
  const modeButtons = document.querySelectorAll('.login-mode-btn');

  let currentMode = 'login';

  // Toggle login/register UI
  function setMode(mode) {
    currentMode = mode;
    modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    submitBtn.textContent = mode === 'login' ? 'Login' : 'Register';

    helperEl.textContent =
      mode === 'login'
        ? 'Login with the same entaingroup.com / lcroot login you registered with.'
        : 'Register: first time playing? Create your game here.';
  }

  modeButtons.forEach(btn =>
    btn.addEventListener('click', () => setMode(btn.dataset.mode))
  );

  setMode('login');

  // Save session to localStorage
  function saveSession(user, game) {
    const session = {
      userId: user.id,
      username: user.username,
      swCode: user.sw_code,
      gameId: game.id,
    };
    localStorage.setItem('sl_session', JSON.stringify(session));
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    let data = null;
    try { data = await res.json(); } catch {}

    return { res, data };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = "";

    const username = fullNameInput.value.trim();
    const swCode = swSelect.value;

    if (!username) return (errorEl.textContent = "Enter your entaingroup.com login.");
    if (!swCode) return (errorEl.textContent = "Select your SW area.");

    submitBtn.disabled = true;
    submitBtn.textContent = currentMode === "login" ? "Logging in…" : "Registering…";

    try {
      if (currentMode === 'register') {
        const { res, data } = await post(REGISTER_ENDPOINT, {
          username,
          email: null,
          swCode
        });

        if (!res.ok) {
          errorEl.textContent = data?.error || `Unable to register (${res.status})`;
          return;
        }

        helperEl.textContent = "Registration successful. Now click Player Login.";
        document.querySelector('.login-mode-btn[data-mode="login"]').click();
        return;
      }

      // LOGIN FLOW
      const { res, data } = await post(LOGIN_ENDPOINT, {
        username,
        email: null,
        swCode
      });

      if (!res.ok) {
        errorEl.textContent =
          data?.error || "Incorrect login or you may need to register first.";
        return;
      }

      saveSession(data.user, data.game);
      window.location.href = "game.html";

    } catch {
      errorEl.textContent = "Network error. Try again.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = currentMode === 'login' ? "Login" : "Register";
    }
  });
});
