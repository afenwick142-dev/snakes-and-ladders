// admin-login.js

const BACKEND_BASE_URL =
  window.SNAKES_BACKEND_URL ||
  "https://snakes-ladders-backend-github.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("admin-login-form");
  const button = document.getElementById("admin-login-button");
  const messageEl = document.getElementById("admin-login-message");

  if (!form || !button || !messageEl) {
    console.error("Admin login form elements not found in DOM.");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const usernameInput = document.getElementById("admin-username");
    const passwordInput = document.getElementById("admin-password");

    const username = (usernameInput.value || "").trim() || "admin";
    const password = passwordInput.value.trim();

    if (!password) {
      showMessage("Please enter the admin password.", "error");
      return;
    }

    button.disabled = true;
    showMessage("Logging in…", "info");

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        const msg =
          (data && (data.error || data.message)) ||
          "Invalid username or password.";
        showMessage(msg, "error");
        button.disabled = false;
        return;
      }

      showMessage("Login successful. Redirecting…", "success");
      setTimeout(() => {
        window.location.href = "admin.html";
      }, 700);
    } catch (err) {
      console.error("Admin login error:", err);
      showMessage("Server error while logging in.", "error");
      button.disabled = false;
    }
  });

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.classList.remove("error", "success");
    if (type === "error") messageEl.classList.add("error");
    if (type === "success") messageEl.classList.add("success");
  }
});
