// admin-change-password.js

const API = "https://snakes-ladders-backend-github.onrender.com";

const currentPw = document.getElementById("currentPw");
const newPw = document.getElementById("newPw");
const changeBtn = document.getElementById("changePwBtn");
const changeError = document.getElementById("changePwError");

changeBtn?.addEventListener("click", async () => {
  const c = (currentPw?.value || "").trim();
  const n = (newPw?.value || "").trim();

  if (!c || !n) {
    if (changeError) changeError.textContent = "Enter both passwords.";
    return;
  }

  try {
    const res = await fetch(`${API}/admin/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        oldPassword: c,
        newPassword: n,
      }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      // ignore JSON parse failure
    }

    if (!res.ok || !data.success) {
      if (changeError)
        changeError.textContent = data.error || "Failed to change password.";
      return;
    }

    alert("Password changed successfully.");
    // force fresh login with new password
    localStorage.removeItem("adminLoggedIn");
    localStorage.removeItem("adminLastActive");
    window.location.href = "admin-login.html";
  } catch (err) {
    console.error("Change password error:", err);
    if (changeError) changeError.textContent = "Server error.";
  }
});
