// admin.js
// Admin portal logic for Snakes & Ladders
// - Requires admin-login.js to have set localStorage.adminLoggedIn = "yes"
// - Expects certain IDs in admin.html (see comments below)

const API = "https://snakes-ladders-backend-github.onrender.com";

// ==== ELEMENT LOOKUPS (MATCH THESE IDS IN admin.html) ====

// Area selection
const areaSelect = document.getElementById("admin-area-select");

// Players table body
const playersTableBody = document.getElementById("admin-players-tbody");

// Grant rolls controls
const grantCountInput = document.getElementById("grant-rolls-count");
const grantEveryoneBtn = document.getElementById("grant-rolls-everyone");
const grantSelectedBtn = document.getElementById("grant-rolls-selected");
const undoGrantBtn = document.getElementById("grant-rolls-undo");

// Prize config controls
const prizeCountInput = document.getElementById("prize-25-count");
const prizeSaveBtn = document.getElementById("prize-save");
const prizeStatusEl = document.getElementById("prize-status");

// General message
const adminMessageEl = document.getElementById("admin-message");

// Logout button (optional)
const logoutBtn = document.getElementById("admin-logout");

// ==== HELPERS ====

function showAdminMessage(msg, isError = false) {
  if (!adminMessageEl) return;
  adminMessageEl.textContent = msg || "";
  adminMessageEl.classList.remove("error", "success");
  if (msg) {
    adminMessageEl.classList.add(isError ? "error" : "success");
  }
}

function getSelectedArea() {
  return (areaSelect?.value || "").trim().toUpperCase();
}

function getSelectedPlayerEmails() {
  const emails = [];
  if (!playersTableBody) return emails;
  const checkboxes = playersTableBody.querySelectorAll(
    "input[type='checkbox'][data-email]"
  );
  checkboxes.forEach((cb) => {
    if (cb.checked) {
      const email = cb.getAttribute("data-email");
      if (email) emails.push(email);
    }
  });
  return emails;
}

function ensureLoggedIn() {
  const flag = localStorage.getItem("adminLoggedIn");
  if (flag !== "yes") {
    // Not logged in, go back to login page
    window.location.href = "admin-login.html";
  }
}

// ==== LOAD PLAYERS FOR AN AREA ====

async function loadPlayersForArea() {
  const area = getSelectedArea();
  if (!area) {
    if (playersTableBody) playersTableBody.innerHTML = "";
    showAdminMessage("Please select an area.", true);
    return;
  }

  showAdminMessage("Loading players…");

  try {
    const res = await fetch(`${API}/players?area=${encodeURIComponent(area)}`);
    if (!res.ok) {
      showAdminMessage("Failed to load players.", true);
      return;
    }

    const players = await res.json();
    renderPlayers(players);
    showAdminMessage(`Loaded ${players.length} players for ${area}.`);
  } catch (err) {
    console.error("Error loading players", err);
    showAdminMessage("Server error loading players.", true);
  }
}

function renderPlayers(players) {
  if (!playersTableBody) return;
  playersTableBody.innerHTML = "";

  if (!Array.isArray(players) || players.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No players found for this area.";
    row.appendChild(cell);
    playersTableBody.appendChild(row);
    return;
  }

  players.forEach((p) => {
    const row = document.createElement("tr");

    // Select checkbox
    const selectCell = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.setAttribute("data-email", p.email);
    selectCell.appendChild(cb);
    row.appendChild(selectCell);

    // Email
    const emailCell = document.createElement("td");
    emailCell.textContent = p.email;
    row.appendChild(emailCell);

    // Position
    const positionCell = document.createElement("td");
    positionCell.textContent = p.position ?? 0;
    row.appendChild(positionCell);

    // Rolls used / granted
    const rollsCell = document.createElement("td");
    const used = p.rolls_used ?? 0;
    const granted = p.rolls_granted ?? 0;
    const available = Math.max(0, granted - used);
    rollsCell.textContent = `${used}/${granted} (avail: ${available})`;
    row.appendChild(rollsCell);

    // Completed
    const completedCell = document.createElement("td");
    completedCell.textContent = p.completed ? "Yes" : "No";
    row.appendChild(completedCell);

    // Reward
    const rewardCell = document.createElement("td");
    rewardCell.textContent =
      p.reward === 25
        ? "£25 Champions"
        : p.reward === 10
        ? "£10 Champions"
        : "-";
    row.appendChild(rewardCell);

    // Actions: Reset / Delete
    const actionsCell = document.createElement("td");

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.className = "btn-small";
    resetBtn.addEventListener("click", () => resetPlayer(p.email, p.area));

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "btn-small danger";
    deleteBtn.addEventListener("click", () => deletePlayer(p.email, p.area));

    actionsCell.appendChild(resetBtn);
    actionsCell.appendChild(deleteBtn);
    row.appendChild(actionsCell);

    playersTableBody.appendChild(row);
  });
}

// ==== RESET / DELETE PLAYER ====

async function resetPlayer(email, area) {
  if (!confirm(`Reset game progress for ${email}?`)) return;

  try {
    const res = await fetch(`${API}/player/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, area }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showAdminMessage(data.error || "Failed to reset player.", true);
      return;
    }

    showAdminMessage(`Reset progress for ${email}.`);
    loadPlayersForArea();
  } catch (err) {
    console.error("Reset player error", err);
    showAdminMessage("Server error resetting player.", true);
  }
}

async function deletePlayer(email, area) {
  if (!confirm(`Delete player ${email} from ${area}?`)) return;

  try {
    const res = await fetch(`${API}/player/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, area }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showAdminMessage(data.error || "Failed to delete player.", true);
      return;
    }

    showAdminMessage(`Deleted player ${email}.`);
    loadPlayersForArea();
  } catch (err) {
    console.error("Delete player error", err);
    showAdminMessage("Server error deleting player.", true);
  }
}

// ==== GRANT ROLLS ====

async function handleGrantRolls(toSelectedOnly) {
  const area = getSelectedArea();
  if (!area) {
    showAdminMessage("Please select an area first.", true);
    return;
  }

  const count = parseInt(grantCountInput?.value || "0", 10);
  if (!Number.isInteger(count) || count === 0) {
    showAdminMessage("Enter a non-zero whole number of rolls to grant/remove.", true);
    return;
  }

  let emails = undefined;
  if (toSelectedOnly) {
    emails = getSelectedPlayerEmails();
    if (!emails.length) {
      showAdminMessage("Select at least one player to grant rolls to.", true);
      return;
    }
  }

  showAdminMessage("Updating rolls…");

  try {
    const res = await fetch(`${API}/grant-rolls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, emails, count }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success !== true) {
      showAdminMessage(
        data.error || "Failed to grant rolls. Check server logs.",
        true
      );
      return;
    }

    showAdminMessage(`Updated rolls for ${data.affected || 0} players in ${area}.`);
    loadPlayersForArea();
  } catch (err) {
    console.error("Grant rolls error", err);
    showAdminMessage("Server error granting rolls.", true);
  }
}

async function handleUndoGrant() {
  const area = getSelectedArea();
  if (!area) {
    showAdminMessage("Please select an area first.", true);
    return;
  }

  if (!confirm(`Undo last rolls grant for ${area}?`)) return;

  showAdminMessage("Undoing last grant…");

  try {
    const res = await fetch(`${API}/grant-rolls/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success !== true) {
      showAdminMessage(
        data.error || "No grant history found for this area.",
        true
      );
      return;
    }

    showAdminMessage(
      `Undid last grant for ${area} (affected ${data.affected || 0} players).`
    );
    loadPlayersForArea();
  } catch (err) {
    console.error("Undo grant error", err);
    showAdminMessage("Server error undoing grant.", true);
  }
}

// ==== PRIZE CONFIG (PER AREA £25 LIMIT + STATUS) ====

async function loadPrizeConfig() {
  const area = getSelectedArea();
  if (!area || !prizeCountInput || !prizeStatusEl) return;

  try {
    const res = await fetch(
      `${API}/area/prize?area=${encodeURIComponent(area)}`
    );
    if (!res.ok) {
      prizeStatusEl.textContent = "No prize settings found.";
      return;
    }

    const data = await res.json();
    const winners = data.winners ?? 0;
    const used25 = data.used25 ?? 0;
    const remaining = data.remaining25 ?? 0;

    prizeCountInput.value = winners.toString();
    prizeStatusEl.textContent = `£25 prizes: ${used25} used / ${winners} total (remaining: ${remaining}).`;
  } catch (err) {
    console.error("Load prize config error", err);
    prizeStatusEl.textContent = "Error loading prize settings.";
  }
}

async function savePrizeConfig() {
  const area = getSelectedArea();
  if (!area) {
    showAdminMessage("Select an area before saving prize settings.", true);
    return;
  }

  if (!prizeCountInput) return;

  const count = parseInt(prizeCountInput.value || "0", 10);
  if (!Number.isInteger(count) || count < 0) {
    showAdminMessage(
      "Enter a non-negative whole number for £25 prize winners.",
      true
    );
    return;
  }

  showAdminMessage("Saving prize settings…");

  try {
    const res = await fetch(`${API}/area/prize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, count }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success !== true) {
      showAdminMessage(
        data.error || "Failed to save prize settings.",
        true
      );
      return;
    }

    showAdminMessage(`Saved £25 prize limit (${count}) for ${area}.`);
    loadPrizeConfig();
  } catch (err) {
    console.error("Save prize config error", err);
    showAdminMessage("Server error saving prize settings.", true);
  }
}

// ==== LOGOUT ====

function handleLogout() {
  localStorage.removeItem("adminLoggedIn");
  window.location.href = "admin-login.html";
}

// ==== WIRES THINGS UP ON LOAD ====

function initAdminPortal() {
  ensureLoggedIn();

  // Change of area -> reload players + prize status
  areaSelect?.addEventListener("change", () => {
    loadPlayersForArea();
    loadPrizeConfig();
  });

  // Grant rolls to everyone in area
  grantEveryoneBtn?.addEventListener("click", () =>
    handleGrantRolls(false)
  );

  // Grant rolls to selected players only
  grantSelectedBtn?.addEventListener("click", () =>
    handleGrantRolls(true)
  );

  // Undo last grant for area
  undoGrantBtn?.addEventListener("click", handleUndoGrant);

  // Save prize config
  prizeSaveBtn?.addEventListener("click", savePrizeConfig);

  // Logout
  logoutBtn?.addEventListener("click", handleLogout);

  // Initial load (if default area is pre-selected)
  if (getSelectedArea()) {
    loadPlayersForArea();
    loadPrizeConfig();
  } else {
    showAdminMessage("Select an area to view players and prize settings.");
  }
}

document.addEventListener("DOMContentLoaded", initAdminPortal);
