// admin-change-password.js
// Allows the single admin user to change their password.

const API = "https://snakes-ladders-backend-github.onrender.com";

const currentPw = document.getElementById("currentPw");
const newPw = document.getElementById("newPw");
const changeBtn = document.getElementById("changePwBtn");
const changeError = document.getElementById("changePwError");

changeBtn?.addEventListener("click", async () => {
  const current = (currentPw?.value || "").trim();
  const updated = (newPw?.value || "").trim();

  if (!current || !updated) {
    if (changeError) changeError.textContent = "Enter both passwords.";
    return;
  }

  if (updated.length < 6) {
    if (changeError) {
      changeError.textContent =
        "New password should be at least 6 characters.";
    }
    return;
  }

  if (changeError) changeError.textContent = "Updating password…";

  try {
    const res = await fetch(`${API}/admin/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldPassword: current,
        newPassword: updated,
      }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok || data.success !== true) {
      if (changeError) {
        changeError.textContent =
          data.error || "Failed to change password.";
      }
      return;
    }

    alert("Password changed successfully. Please log in again.");
    localStorage.removeItem("adminLoggedIn");
    localStorage.removeItem("adminLastActive");
    window.location.href = "admin-login.html";
  } catch (err) {
    console.error("Change password error:", err);
    if (changeError) changeError.textContent = "Server error.";
  }
});
