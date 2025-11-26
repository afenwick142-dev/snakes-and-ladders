// admin.js
const API = "https://snakes-ladders-backend-github.onrender.com";

// ELEMENTS
const areaSelect = document.getElementById("adminArea");
const grantCountInput = document.getElementById("grantCount");
const grantBtn = document.getElementById("grantBtn");
const grantSelectedBtn = document.getElementById("grantSelectedBtn");
const undoGrantBtn = document.getElementById("undoGrantBtn");
const prizeInput = document.getElementById("prizeCount");
const savePrizeBtn = document.getElementById("savePrizeBtn");
const playersTableBody = document.getElementById("playersTableBody");
const selectAllPlayers = document.getElementById("selectAllPlayers");
const usersStatus = document.getElementById("usersStatus");
const playersAreaLabel = document.getElementById("playersAreaLabel");

// force login
if (localStorage.getItem("adminLoggedIn") !== "yes") {
    window.location.href = "admin-login.html";
}

// area label
function updatePlayersAreaLabel() {
    playersAreaLabel.textContent = areaSelect.value;
}

// load players
async function loadPlayers() {
    const area = areaSelect.value;

    try {
        const res = await fetch(`${API}/players/${area}`);
        const data = await res.json();

        playersTableBody.innerHTML = "";
        updatePlayersAreaLabel();

        if (!res.ok) {
            usersStatus.textContent = data.error || "Error loading players";
            return;
        }

        usersStatus.textContent = `Loaded ${data.length} player(s) in ${area}.`;

        data.forEach(p => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td><input type="checkbox" class="player-select" data-email="${p.email}"></td>
                <td>${p.email}</td>
                <td>${p.area}</td>
                <td>${p.position}</td>
                <td>${p.rolls_used}</td>
                <td>${p.rolls_granted}</td>
                <td>${p.completed ? "Yes" : "No"}</td>
                <td>${p.reward ? "£" + p.reward : "-"}</td>
                <td>
                    <button class="btn-table" data-email="${p.email}" data-action="reset">Reset</button>
                    <button class="btn-table" data-email="${p.email}" data-action="delete">Delete</button>
                </td>
            `;

            playersTableBody.appendChild(tr);
        });

        document.querySelectorAll('.btn-table').forEach(btn => {
            btn.addEventListener('click', handleRowAction);
        });

    } catch (err) {
        usersStatus.textContent = "Server error.";
    }
}

// reset/delete
async function handleRowAction(e) {
    const email = e.target.getAttribute("data-email");
    const action = e.target.getAttribute("data-action");

    if (action === "reset") {
        if (!confirm(`Reset ${email}?`)) return;

        const res = await fetch(`${API}/player/reset`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ email })
        });

        alert("Player reset.");
        loadPlayers();
    }

    if (action === "delete") {
        if (!confirm(`Delete ${email}?`)) return;

        const res = await fetch(`${API}/player/delete`, {
            method: "DELETE",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ email })
        });

        alert("Player deleted.");
        loadPlayers();
    }
}

// GRANT AREA ROLLS
grantBtn.addEventListener("click", async () => {
    const area = areaSelect.value;
    const count = Number(grantCountInput.value || 0);
    if (count < 1) return alert("Enter a roll count");

    const res = await fetch(`${API}/rolls/grant/${area}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ count })
    });

    alert("Rolls granted.");
    loadPlayers();
});

// GRANT SELECTED PLAYERS
grantSelectedBtn.addEventListener("click", async () => {
    const count = Number(grantCountInput.value || 0);
    if (count < 1) return alert("Enter rolls");

    const emails = [...document.querySelectorAll(".player-select:checked")].map(i => i.dataset.email);

    if (!emails.length) return alert("Select players");

    const res = await fetch(`${API}/rolls/grant-selected`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ emails, count })
    });

    alert("Rolls granted to selected players.");
    loadPlayers();
});

// UNDO GRANT
undoGrantBtn.addEventListener("click", async () => {
    const area = areaSelect.value;

    const res = await fetch(`${API}/rolls/undo/${area}`, {
        method: "POST"
    });

    alert("Undo complete.");
    loadPlayers();
});

// PRIZE SETTINGS
savePrizeBtn.addEventListener("click", async () => {
    const area = areaSelect.value;
    const max = Number(prizeInput.value || 0);

    const res = await fetch(`${API}/prize/${area}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ max })
    });

    alert("Prize saved.");
});

// INIT
areaSelect.addEventListener("change", loadPlayers);
selectAllPlayers.addEventListener("change", () => {
    document.querySelectorAll(".player-select").forEach(cb => cb.checked = selectAllPlayers.checked);
});

loadPlayers();
