// admin-login.js

// Backend base URL (Render)
const BACKEND_BASE_URL =
  window.SNAKES_BACKEND_URL ||
  "https://snakes-ladders-backend.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("admin-login-form");
  const button = document.getElementById("admin-login-button");
  const messageEl = document.getElementById("admin-login-message");

  if (!form || !button || !messageEl) {
    console.error("Admin login elements not found in DOM.");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const usernameInput = document.getElementById("admin-username");
    const passwordInput = document.getElementById("admin-password");

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showMessage("Please enter both username and password.", "error");
      return;
    }

    button.disabled = true;
    showMessage("Logging in...", "info");

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
          data && data.error
            ? data.error
            : "Login failed. Please check your details.";
        showMessage(msg, "error");
        button.disabled = false;
        return;
      }

      // Mark admin as logged in on the client side.
      localStorage.setItem("snakes_admin_logged_in", "true");

      showMessage("Login successful. Redirecting...", "success");

      // Redirect to admin panel
      window.location.href = "admin.html";
    } catch (err) {
      console.error("Error logging in:", err);
      showMessage("Server error while logging in.", "error");
      button.disabled = false;
    }
  });

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.classList.remove("error", "success");

    if (type === "error") {
      messageEl.classList.add("error");
    } else if (type === "success") {
      messageEl.classList.add("success");
    }
  }
});
