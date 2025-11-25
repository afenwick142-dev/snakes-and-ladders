// admin.js
const API = "https://snakes-ladders-backend-github.onrender.com";

// Elements
const areaSelect = document.getElementById("adminArea");
const playersTable = document.getElementById("playersTable");
const playersAreaLabel = document.getElementById("playersAreaLabel");

function updatePlayersAreaLabel() {
    if (!areaSelect || !playersAreaLabel) return;
    const area = areaSelect.value || "SW1";
    playersAreaLabel.textContent = area;
}

const grantCountInput = document.getElementById("grantCount");
const grantBtn = document.getElementById("grantBtn");
const prizeSaveBtn = document.getElementById("savePrizeBtn");
const prizeInput = document.getElementById("prizeCount");
const grantSelectedBtn = document.getElementById("grantSelectedBtn");
const undoGrantBtn = document.getElementById("undoGrantBtn");
const playersTableBody = document.getElementById("playersTableBody");
const selectAllPlayers = document.getElementById("selectAllPlayers");
const usersStatus = document.getElementById("usersStatus");

// Require login
if (localStorage.getItem("adminLoggedIn") !== "yes") {
    window.location.href = "admin-login.html";
}

// Load players when area changes
areaSelect?.addEventListener("change", () => { updatePlayersAreaLabel(); loadPlayers(); });
updatePlayersAreaLabel();
loadPlayers();

async function loadPlayers() {
    const area = areaSelect.value;

    try {
        const res = await fetch(`${API}/players?area=${area}`);
        const data = await res.json();
        playersTableBody.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            usersStatus.textContent = `No players found in ${area}.`;
            return;
        }

        usersStatus.textContent = `Loaded ${data.length} player(s) in ${area}.`;

        data.forEach(player => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td><input type="checkbox" class="player-select" data-email="${player.email}" /></td>
                <td>${player.email}</td>
                <td>${player.area || area}</td>
                <td>${player.position}</td>
                <td>${player.rolls_used}</td>
                <td>${player.rolls_granted}</td>
                <td>${player.completed ? "Yes" : "No"}</td>
                <td>${player.reward ? "£" + player.reward : "-"}</td>
                <td>
                  <button class="btn-table reset-btn" data-email="${player.email}">Reset</button>
                  <button class="btn-table delete-btn" data-email="${player.email}">Delete</button>
                </td>
            `;

            playersTableBody.appendChild(tr);
        });

        // Wire up row buttons
        document.querySelectorAll(".reset-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const email = btn.getAttribute("data-email");
                resetPlayer(email);
            });
        });

        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const email = btn.getAttribute("data-email");
                deletePlayer(email);
            });
        });

    } catch (err) {
        console.error(err);
        usersStatus.textContent = "Error loading players.";
    }
}

// Select / deselect all players
selectAllPlayers?.addEventListener("change", () => {
    const checked = selectAllPlayers.checked;
    document
        .querySelectorAll(".player-select")
        .forEach(cb => (cb.checked = checked));
});

// Grant rolls to all OR selected
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
            alert(data.error || "Failed granting rolls.");
            return;
        }

        alert(`Granted ${count} roll(s) to all players in ${area}.`);
        loadPlayers();
    } catch (err) {
        console.error(err);
        alert("Server error.");
    }
});

grantSelectedBtn?.addEventListener("click", async () => {
    const area = areaSelect.value;
    const count = parseInt(grantCountInput.value);

    if (!count || count === 0) {
        alert("Enter roll amount (not zero).");
        return;
    }

    const selectedEmails = Array.from(
        document.querySelectorAll(".player-select:checked")
    ).map(cb => cb.getAttribute("data-email"));

    if (selectedEmails.length === 0) {
        alert("Select at least one player.");
        return;
    }

    try {
        const res = await fetch(`${API}/grant-rolls-selected`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ area, count, emails: selectedEmails })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed granting rolls to selected players.");
            return;
        }

        alert(`Granted ${count} roll(s) to ${selectedEmails.length} selected player(s) in ${area}.`);
        loadPlayers();
    } catch (err) {
        console.error(err);
        alert("Server error.");
    }
});

// Undo last grant for area
undoGrantBtn?.addEventListener("click", async () => {
    const area = areaSelect.value;

    if (!confirm(`Undo the last grant of rolls in ${area}?`)) {
        return;
    }

    try {
        const res = await fetch(`${API}/undo-last-grant`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ area })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed to undo last grant.");
            return;
        }

        alert(`Last grant in ${area} has been undone.`);
        loadPlayers();
    } catch (err) {
        console.error(err);
        alert("Server error.");
    }
});

// Reset / delete player helpers
async function resetPlayer(email) {
    const area = areaSelect.value;

    if (!confirm(`Reset game for ${email} in ${area}?`)) {
        return;
    }

    try {
        const res = await fetch(`${API}/reset-player`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, area })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed to reset player.");
            return;
        }

        alert(`Player ${email} has been reset.`);
        loadPlayers();
    } catch (err) {
        console.error(err);
        alert("Server error.");
    }
}

async function deletePlayer(email) {
    const area = areaSelect.value;

    if (!confirm(`Delete ${email} from ${area}? This cannot be undone.`)) {
        return;
    }

    try {
        const res = await fetch(`${API}/delete-player`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, area })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed to delete player.");
            return;
        }

        alert(`Player ${email} has been deleted.`);
        loadPlayers();
    } catch (err) {
        console.error(err);
        alert("Server error.");
    }
}

// PRIZE SETTINGS
prizeSaveBtn?.addEventListener("click", async () => {
    const area = areaSelect.value;
    const maxWinners = parseInt(prizeInput.value);

    if (isNaN(maxWinners) || maxWinners < 0) {
        alert("Enter a valid non-negative number for max £25 winners.");
        return;
    }

    try {
        const res = await fetch(`${API}/prize-settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ area, maxWinners })
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
