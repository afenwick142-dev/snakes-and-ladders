// admin-login.js

const API = "https://snakes-ladders-backend-github.onrender.com";

const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminPasswordInput = document.getElementById("adminPassword");
const adminError = document.getElementById("adminLoginError");

adminLoginBtn?.addEventListener("click", async () => {
    const password = adminPasswordInput.value.trim();

    if (!password) {
        adminError.textContent = "Password required.";
        return;
    }

    try {
        const res = await fetch(`${API}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password })
        });

        const data = await res.json();

        if (!res.ok) {
            adminError.textContent = data.error || "Invalid password.";
            return;
        }

        localStorage.setItem("adminLoggedIn", "yes");

        window.location.href = "admin.html";
    } catch (err) {
        adminError.textContent = "Server error.";
    }
});
