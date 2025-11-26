// admin.js
const API = "https://snakes-ladders-backend-github.onrender.com";

// --- ELEMENTS ---
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

// --- SIMPLE AUTH GUARD ---
if (localStorage.getItem("adminLoggedIn") !== "yes") {
  window.location.href = "admin-login.html";
}

// --- HELPERS ---
function normaliseArea(value) {
  return (value || "").trim().toUpperCase();
}

function updatePlayersAreaLabel() {
  if (!areaSelect || !playersAreaLabel) return;
  const area = normaliseArea(areaSelect.value || "SW1");
  playersAreaLabel.textContent = area;
}

function showStatus(msg) {
  if (usersStatus) {
    usersStatus.textContent = msg || "";
  }
}

// --- LOAD PLAYERS FOR AREA ---
async function loadPlayers() {
  const area = normaliseArea(areaSelect.value);

  try {
    const res = await fetch(`${API}/players?area=${encodeURIComponent(area)}`);
    const data = await res.json();

    playersTableBody.innerHTML = "";
    updatePlayersAreaLabel();

    if (!res.ok) {
      showStatus(data.error || "Error loading players.");
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      showStatus(`No players found in ${area}.`);
      return;
    }

    showStatus(`Loaded ${data.length} player(s) in ${area}.`);

    data.forEach((player) => {
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
        <td class="actions-cell">
          <button class="btn-table grant-one-btn" data-email="${player.email}">Grant</button>
          <button class="btn-table reset-btn" data-email="${player.email}">Reset</button>
          <button class="btn-table delete-btn" data-email="${player.email}">Delete</button>
        </td>
      `;

      playersTableBody.appendChild(tr);
    });

    // Wire up row buttons
    document.querySelectorAll(".grant-one-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const email = btn.getAttribute("data-email");
        grantToSinglePlayer(email);
      });
    });

    document.querySelectorAll(".reset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const email = btn.getAttribute("data-email");
        resetPlayer(email);
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const email = btn.getAttribute("data-email");
        deletePlayer(email);
      });
    });
  } catch (err) {
    console.error("Error loading players", err);
    showStatus("Error loading players.");
  }
}

// Keep label + table in sync when area changes
areaSelect?.addEventListener("change", () => {
  updatePlayersAreaLabel();
  loadPlayers();
});
updatePlayersAreaLabel();
loadPlayers();

// Select / deselect all players
selectAllPlayers?.addEventListener("change", () => {
  const checked = selectAllPlayers.checked;
  document
    .querySelectorAll(".player-select")
    .forEach((cb) => (cb.checked = checked));
});

// --- GRANT ROLLS TO AREA ---
grantBtn?.addEventListener("click", async () => {
  const area = normaliseArea(areaSelect.value);
  const count = parseInt(grantCountInput.value, 10);

  if (!Number.isInteger(count) || count === 0) {
    alert("Enter roll amount (non-zero whole number).");
    return;
  }

  try {
    const res = await fetch(`${API}/grant-rolls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, count }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed granting rolls.");
      return;
    }

    alert(`Granted ${count} roll(s) to all players in ${area}.`);
    loadPlayers();
  } catch (err) {
    console.error("Grant rolls error", err);
    alert("Server error.");
  }
});

// --- GRANT ROLLS TO SELECTED PLAYERS ---
grantSelectedBtn?.addEventListener("click", async () => {
  const area = normaliseArea(areaSelect.value);
  const count = parseInt(grantCountInput.value, 10);

  if (!Number.isInteger(count) || count === 0) {
    alert("Enter roll amount (non-zero whole number).");
    return;
  }

  const selectedEmails = Array.from(
    document.querySelectorAll(".player-select:checked")
  ).map((cb) => cb.getAttribute("data-email"));

  if (selectedEmails.length === 0) {
    alert("Select at least one player.");
    return;
  }

  try {
    const res = await fetch(`${API}/grant-rolls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, count, emails: selectedEmails }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed granting rolls to selected players.");
      return;
    }

    alert(
      `Granted ${count} roll(s) to ${selectedEmails.length} selected player(s) in ${area}.`
    );
    loadPlayers();
  } catch (err) {
    console.error("Grant selected rolls error", err);
    alert("Server error.");
  }
});

// Grant to a single player (row button)
async function grantToSinglePlayer(email) {
  const area = normaliseArea(areaSelect.value);
  const input = prompt(
    `Grant how many extra rolls to ${email}? (use a positive whole number)`
  );
  if (input === null) return;

  const count = parseInt(input, 10);
  if (!Number.isInteger(count) || count <= 0) {
    alert("Please enter a positive whole number.");
    return;
  }

  try {
    const res = await fetch(`${API}/grant-rolls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, count, emails: [email] }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed granting rolls.");
      return;
    }

    alert(`Granted ${count} roll(s) to ${email} in ${area}.`);
    loadPlayers();
  } catch (err) {
    console.error("Grant single player error", err);
    alert("Server error.");
  }
}

// --- UNDO LAST GRANT (per-area) ---
undoGrantBtn?.addEventListener("click", async () => {
  const area = normaliseArea(areaSelect.value);

  if (
    !confirm(
      `Undo the last grant of rolls recorded for ${area}? (This will reverse only the most recent grant for this area.)`
    )
  ) {
    return;
  }

  try {
    const res = await fetch(`${API}/grant-rolls/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to undo last grant.");
      return;
    }

    alert("Last grant has been undone for " + area + ".");
    loadPlayers();
  } catch (err) {
    console.error("Undo grant error", err);
    alert("Server error.");
  }
});

// --- RESET PLAYER ---
async function resetPlayer(email) {
  const area = normaliseArea(areaSelect.value);

  if (
    !confirm(
      `Reset progress for ${email} in ${area}? Position, rolls and reward will be cleared.`
    )
  ) {
    return;
  }

  try {
    const res = await fetch(`${API}/player/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, area }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to reset player.");
      return;
    }

    alert(`Player ${email} has been reset.`);
    loadPlayers();
  } catch (err) {
    console.error("Reset player error", err);
    alert("Server error.");
  }
}

// --- DELETE PLAYER ---
async function deletePlayer(email) {
  const area = normaliseArea(areaSelect.value);

  if (!confirm(`Delete ${email} from ${area}? This cannot be undone.`)) {
    return;
  }

  try {
    const res = await fetch(`${API}/player/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, area }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to delete player.");
      return;
    }

    alert(`Player ${email} has been deleted.`);
    loadPlayers();
  } catch (err) {
    console.error("Delete player error", err);
    alert("Server error.");
  }
}

// --- PRIZE SETTINGS ---
savePrizeBtn?.addEventListener("click", async () => {
  const area = normaliseArea(areaSelect.value);
  const maxWinners = parseInt(prizeInput.value, 10);

  if (!Number.isInteger(maxWinners) || maxWinners < 0) {
    alert("Enter a valid non-negative number for max £25 winners.");
    return;
  }

  try {
    const res = await fetch(`${API}/area/prize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, count: maxWinners }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed saving prize settings.");
      return;
    }

    alert("Prize settings saved for " + area + ".");
  } catch (err) {
    console.error("Prize settings error", err);
    alert("Server error.");
  }
});
