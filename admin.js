// admin.js – Snakes & Ladders Admin
// Works with admin.html from your project

const API = "https://snakes-ladders-backend-github.onrender.com";

// Elements
const areaSelect = document.getElementById("adminArea");
const grantCountInput = document.getElementById("grantCount");
const grantBtn = document.getElementById("grantBtn");
const grantSelectedBtn = document.getElementById("grantSelectedBtn");
const undoGrantBtn = document.getElementById("undoGrantBtn");

const prizeCountInput = document.getElementById("prizeCount");
const savePrizeBtn = document.getElementById("savePrizeBtn");

const selectAllCheckbox = document.getElementById("selectAllPlayers");
const playersTableBody = document.getElementById("playersTableBody");
const playersAreaLabel = document.getElementById("playersAreaLabel");
const usersStatus = document.getElementById("usersStatus");

let currentArea = areaSelect ? areaSelect.value : "SW1";

function updatePlayersAreaLabel() {
  if (playersAreaLabel) playersAreaLabel.textContent = currentArea;
}

// ---- helpers ----
function getSelectedEmails() {
  const rows = playersTableBody?.querySelectorAll("tr") || [];
  const emails = [];
  rows.forEach((row) => {
    const cb = row.querySelector("input[type=checkbox]");
    if (cb && cb.checked) {
      const emailCell = row.querySelector("[data-col='email']");
      if (emailCell) emails.push(emailCell.textContent.trim());
    }
  });
  return emails;
}

function setStatus(msg, isError = false) {
  if (!usersStatus) return;
  usersStatus.textContent = msg || "";
  usersStatus.classList.toggle("status-error", !!isError);
}

// ---- Load players for area ----
async function loadPlayers() {
  if (!playersTableBody) return;
  playersTableBody.innerHTML = "";
  setStatus("Loading players...");

  try {
    const res = await fetch(
      `${API}/admin/players?area=${encodeURIComponent(currentArea)}`
    );
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || "Failed to load players.", true);
      return;
    }

    if (!Array.isArray(data.players) || data.players.length === 0) {
      setStatus(`No players found in ${currentArea}.`);
      return;
    }

    data.players.forEach((p) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td><input type="checkbox" class="row-select"></td>
        <td data-col="email">${p.email}</td>
        <td>${p.area}</td>
        <td>${p.position}</td>
        <td>${p.rollsUsed}</td>
        <td>${p.rollsGranted}</td>
        <td>${p.completed ? "Yes" : "No"}</td>
        <td>${p.reward ? "£" + p.reward : "-"}</td>
        <td class="actions">
          <button class="btn btn-secondary btn-small action-grant">Grant</button>
          <button class="btn btn-secondary btn-small action-reset">Reset</button>
          <button class="btn btn-secondary btn-small action-delete">Delete</button>
        </td>
      `;

      // Per-row actions
      const [grantBtnRow, resetBtn, deleteBtn] = tr.querySelectorAll("button");

      grantBtnRow.addEventListener("click", () => {
        const amount = parseInt(grantCountInput.value || "1", 10) || 1;
        grantToPlayer(p.email, amount);
      });

      resetBtn.addEventListener("click", () => resetPlayer(p.email));
      deleteBtn.addEventListener("click", () => deletePlayer(p.email));

      playersTableBody.appendChild(tr);
    });

    setStatus(`Loaded ${data.players.length} player(s) in ${currentArea}.`);
  } catch (err) {
    console.error(err);
    setStatus("Server error loading players.", true);
  }
}

// ---- Admin actions ----
async function grantToArea() {
  const amount = parseInt(grantCountInput.value || "1", 10);
  if (!amount || amount <= 0) {
    alert("Enter a positive number of rolls to grant.");
    return;
  }

  try {
    const res = await fetch(`${API}/admin/grant-area`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: currentArea, rolls: amount })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to grant rolls to area.");
      return;
    }
    alert(`Granted ${amount} roll(s) to all players in ${currentArea}.`);
    await loadPlayers();
  } catch (err) {
    console.error(err);
    alert("Server error.");
  }
}

async function grantToSelected() {
  const amount = parseInt(grantCountInput.value || "1", 10);
  if (!amount || amount <= 0) {
    alert("Enter a positive number of rolls to grant.");
    return;
  }

  const emails = getSelectedEmails();
  if (emails.length === 0) {
    alert("Select at least one player to grant rolls.");
    return;
  }

  try {
    const res = await fetch(`${API}/admin/grant-selected`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: currentArea, rolls: amount, emails })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to grant rolls to selected players.");
      return;
    }
    alert(`Granted ${amount} roll(s) to ${emails.length} player(s).`);
    await loadPlayers();
  } catch (err) {
    console.error(err);
    alert("Server error.");
  }
}

async function grantToPlayer(email) {
  const amount = parseInt(grantCountInput.value || "1", 10);
  if (!amount || amount <= 0) {
    alert("Enter a positive number of rolls to grant.");
    return;
  }

  try {
    const res = await fetch(`${API}/admin/grant-player`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: currentArea, email, rolls: amount })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to grant rolls.");
      return;
    }
    await loadPlayers();
  } catch (err) {
    console.error(err);
    alert("Server error.");
  }
}

async function undoLastGrant() {
  try {
    const res = await fetch(`${API}/admin/undo-last-grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: currentArea })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to undo last grant.");
      return;
    }
    alert(data.message || "Last grant undone.");
    await loadPlayers();
  } catch (err) {
    console.error(err);
    alert("Server error.");
  }
}

async function resetPlayer(email) {
  if (!confirm(`Reset progress for ${email}?`)) return;

  try {
    const res = await fetch(`${API}/admin/reset-player`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: currentArea, email })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to reset player.");
      return;
    }
    await loadPlayers();
  } catch (err) {
    console.error(err);
    alert("Server error.");
  }
}

async function deletePlayer(email) {
  if (!confirm(`Delete player ${email}? This cannot be undone.`)) return;

  try {
    const res = await fetch(
      `${API}/admin/player?area=${encodeURIComponent(
        currentArea
      )}&email=${encodeURIComponent(email)}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to delete player.");
      return;
    }
    await loadPlayers();
  } catch (err) {
    console.error(err);
    alert("Server error.");
  }
}

// ---- Prize settings (max £25 per area) ----
async function loadPrizeSettings() {
  if (!prizeCountInput) return;

  try {
    const res = await fetch(
      `${API}/area/prize?area=${encodeURIComponent(currentArea)}`
    );
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to load prize settings.", true);
      return;
    }

    prizeCountInput.value =
      typeof data.max25 === "number" ? String(data.max25) : "";
    if (data.max25 != null) {
      setStatus(
        `£25 remaining in ${currentArea}: ${data.remaining25} of ${data.max25}.`
      );
    }
  } catch (err) {
    console.error(err);
    setStatus("Server error loading prize settings.", true);
  }
}

async function savePrizeSettings() {
  const max25 = parseInt(prizeCountInput.value || "0", 10);
  if (max25 < 0) {
    alert("Max £25 winners cannot be negative.");
    return;
  }

  try {
    const res = await fetch(`${API}/area/prize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: currentArea, max25 })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed saving prize settings.");
      return;
    }

    alert("Prize settings saved.");
    await loadPrizeSettings();
  } catch (err) {
    console.error(err);
    alert("Server error.");
  }
}

// ---- events ----
areaSelect?.addEventListener("change", () => {
  currentArea = areaSelect.value || "SW1";
  updatePlayersAreaLabel();
  loadPlayers();
  loadPrizeSettings();
});

grantBtn?.addEventListener("click", grantToArea);
grantSelectedBtn?.addEventListener("click", grantToSelected);
undoGrantBtn?.addEventListener("click", undoLastGrant);
savePrizeBtn?.addEventListener("click", savePrizeSettings);

selectAllCheckbox?.addEventListener("change", () => {
  const rows = playersTableBody?.querySelectorAll("tr") || [];
  rows.forEach((row) => {
    const cb = row.querySelector("input[type=checkbox]");
    if (cb) cb.checked = selectAllCheckbox.checked;
  });
});

// ---- init ----
currentArea = areaSelect ? areaSelect.value || "SW1" : "SW1";
updatePlayersAreaLabel();
loadPlayers();
loadPrizeSettings();
