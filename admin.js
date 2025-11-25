// admin.js
const API = "https://snakes-ladders-backend-github.onrender.com";

// Elements
const areaSelect = document.getElementById("adminArea");
const playersTable = document.getElementById("playersTable");
const grantCountInput = document.getElementById("grantCount");
const grantBtn = document.getElementById("grantBtn");
const prizeSaveBtn = document.getElementById("savePrizeBtn");
const prizeInput = document.getElementById("prizeCount");

// Require login
if (localStorage.getItem("adminLoggedIn") !== "yes") {
    window.location.href = "admin-login.html";
}

// Load players when area changes
areaSelect?.addEventListener("change", loadPlayers);
loadPlayers();

async function loadPlayers() {
    const area = areaSelect.value;

    try {
        const res = await fetch(`${API}/players?area=${area}`);
        const data = await res.json();
        playersTable.innerHTML = "";

        data.forEach(player => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${player.email}</td>
                <td>${player.position}</td>
                <td>${player.rolls_used}</td>
                <td>${player.rolls_granted}</td>
                <td>${player.completed ? "Yes" : "No"}</td>
                <td>${player.reward ? "£" + player.reward : "-"}</td>
            `;
            playersTable.appendChild(tr);
        });

    } catch (err) {
        alert("Error loading players.");
    }
}

// --- GRANT ROLLS ---
grantBtn?.addEventListener("click", async () => {
    const area = areaSelect.value;
    const count = parseInt(grantCountInput.value);

    if (!count || count === 0) {
        alert("Enter roll amount (not zero).");
        return;
    }

    try {
        const res = await fetch(`${API}/grant-rolls`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ area, count })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed.");
            return;
        }

        alert("Rolls granted!");
        loadPlayers();

    } catch (err) {
        alert("Server error.");
    }
});

// --- SAVE PRIZE SETTINGS ---
prizeSaveBtn?.addEventListener("click", async () => {
    const area = areaSelect.value;
    const count = parseInt(prizeInput.value);

    if (count < 0 || isNaN(count)) {
        alert("Invalid prize count.");
        return;
    }

    try {
        const res = await fetch(`${API}/area/prize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ area, count })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed saving prize settings.");
            return;
        }

        alert("Prize settings saved!");

    } catch (err) {
        alert("Server error.");
    }
});
