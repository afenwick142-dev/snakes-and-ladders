// admin-change-password.js

const API = "https://snakes-ladders-backend-github.onrender.com";

const currentPw = document.getElementById("currentPw");
const newPw = document.getElementById("newPw");
const changeBtn = document.getElementById("changePwBtn");
const changeError = document.getElementById("changePwError");

changeBtn?.addEventListener("click", async () => {
    const c = currentPw.value.trim();
    const n = newPw.value.trim();

    if (!c || !n) {
        changeError.textContent = "Enter both passwords.";
        return;
    }

    try {
        const res = await fetch(`${API}/admin/change-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword: c, newPassword: n })
        });

        const data = await res.json();

        if (!res.ok) {
            changeError.textContent = data.error || "Failed.";
            return;
        }

        alert("Password changed successfully.");
        window.location.href = "admin-login.html";

    } catch (err) {
        changeError.textContent = "Server error.";
    }
});
