// admin-login.js
// Simple admin login page that sets localStorage and sends you to admin.html

const API = "https://snakes-ladders-backend-github.onrender.com";

const form = document.getElementById("admin-login-form");
const usernameInput = document.getElementById("admin-username");
const passwordInput = document.getElementById("admin-password");
const messageEl = document.getElementById("admin-login-message");
const loginButton = document.getElementById("admin-login-button");

function showAdminMessage(msg, isError = true) {
  if (!messageEl) return;
  messageEl.textContent = msg || "";
  messageEl.classList.remove("error", "success");
  if (isError) {
    messageEl.classList.add("error");
  } else {
    messageEl.classList.add("success");
  }
}

async function handleAdminLogin(evt) {
  evt.preventDefault();
  showAdminMessage("");

  const username = (usernameInput?.value || "admin").trim() || "admin";
  const password = (passwordInput?.value || "").trim();

  if (!password) {
    showAdminMessage("Password required.");
    return;
  }

  loginButton && (loginButton.disabled = true);

  try {
    const res = await fetch(`${API}/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      // ignore parse errors
    }

    if (!res.ok || data.success !== true) {
      const msg = (data && data.error) || "Invalid password.";
      showAdminMessage(msg, true);
      loginButton && (loginButton.disabled = false);
      return;
    }

    // success
    localStorage.setItem("adminLoggedIn", "yes");
    showAdminMessage("Login successful. Redirecting…", false);

    window.location.href = "admin.html";
  } catch (err) {
    console.error("Admin login error:", err);
    showAdminMessage("Server error – please try again.");
    loginButton && (loginButton.disabled = false);
  }
}

form?.addEventListener("submit", handleAdminLogin);
