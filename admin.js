// admin.js
// Admin portal logic for Snakes & Ladders

const API = "https://snakes-ladders-backend-github.onrender.com";
const ADMIN_IDLE_MS = 5 * 60 * 1000; // 5 minutes

// ----- ELEMENTS -----
const areaSelect = document.getElementById("adminArea");

const playersTableBody = document.getElementById("playersTableBody");
let playersAreaLabel = document.getElementById("playersAreaLabel");
const selectAllCheckbox = document.getElementById("selectAllPlayers");
const usersStatusEl = document.getElementById("usersStatus");

const grantCountInput = document.getElementById("grantCount");
const grantEveryoneBtn = document.getElementById("grantBtn");
const grantSelectedBtn = document.getElementById("grantSelectedBtn");
const undoGrantBtn = document.getElementById("undoGrantBtn");

const prizeCountInput = document.getElementById("prizeCount");
const prizeSaveBtn = document.getElementById("savePrizeBtn");
const prizeStatusEl = document.getElementById("prizeStatus");

// ----- HELPERS -----
function showStatus(msg, isError = false) {
  if (!usersStatusEl) return;
  usersStatusEl.textContent = msg || "";
  usersStatusEl.classList.remove("error", "success");
  if (msg) {
    usersStatusEl.classList.add(isError ? "error" : "success");
  }
}

function getSelectedArea() {
  return (areaSelect?.value || "").trim().toUpperCase();
}

// update last active timestamp in localStorage
function touchAdminActivity() {
  localStorage.setItem("adminLastActive", String(Date.now()));
}

function ensureLoggedIn() {
  const flag = localStorage.getItem("adminLoggedIn");
  const lastActive = parseInt(
    localStorage.getItem("adminLastActive") || "0",
    10
  );
  const now = Date.now();

  if (flag !== "yes" || !lastActive || now - lastActive > ADMIN_IDLE_MS) {
    // expired session – log out
    localStorage.removeItem("adminLoggedIn");
    localStorage.removeItem("adminLastActive");
    window.location.href = "admin-login.html";
    return;
  }

  // still valid – refresh activity time
  touchAdminActivity();
}

function getSelectedPlayerEmails() {
  if (!playersTableBody) return [];
  const emails = [];
  const checks = playersTableBody.querySelectorAll(
    "input[type='checkbox'][data-email]"
  );
  checks.forEach((cb) => {
    if (cb.checked) {
      const email = cb.getAttribute("data-email");
      if (email) emails.push(email);
    }
  });
  return emails;
}

// ----- LOAD & RENDER PLAYERS -----
async function loadPlayersForArea() {
  const area = getSelectedArea();
  if (!area) {
    if (playersTableBody) playersTableBody.innerHTML = "";
    showStatus("Please select an area.", true);
    return;
  }

  showStatus("Loading players…");

  try {
    const res = await fetch(
      `${API}/admin/players?area=${encodeURIComponent(area)}`
    );
    if (!res.ok) {
      showStatus("Failed to load players.", true);
      return;
    }

    const data = await res.json();
    const players = Array.isArray(data.players) ? data.players : [];
    renderPlayers(players, area);
    showStatus(`Loaded ${players.length} players for ${area}.`);
  } catch (err) {
    console.error("Error loading players:", err);
    showStatus("Server error loading players.", true);
  }
}

function renderPlayers(players, area) {
  if (!playersTableBody) return;
  playersTableBody.innerHTML = "";

  // Update "Players in SWx (n)" label
  const header = playersAreaLabel?.parentNode;
  if (header) {
    header.innerHTML = `Players in <span id="playersAreaLabel">${area}</span> (${players.length})`;
    playersAreaLabel = document.getElementById("playersAreaLabel");
  }

  if (!Array.isArray(players) || players.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 9;
    cell.textContent = "No players found for this area.";
    row.appendChild(cell);
    playersTableBody.appendChild(row);
    return;
  }

  players.forEach((p) => {
    const row = document.createElement("tr");

    // select checkbox
    const selectCell = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.setAttribute("data-email", p.email);
    selectCell.appendChild(cb);
    row.appendChild(selectCell);

    // email
    const emailCell = document.createElement("td");
    emailCell.textContent = p.email;
    row.appendChild(emailCell);

    // area
    const areaCell = document.createElement("td");
    areaCell.textContent = p.area;
    row.appendChild(areaCell);

    // position
    const posCell = document.createElement("td");
    posCell.textContent = p.position ?? 0;
    row.appendChild(posCell);

    // rolls used
    const usedCell = document.createElement("td");
    usedCell.textContent = p.rolls_used ?? 0;
    row.appendChild(usedCell);

    // rolls granted
    const grantedCell = document.createElement("td");
    const used = p.rolls_used ?? 0;
    const granted = p.rolls_granted ?? 0;
    const available = Math.max(0, granted - used);
    grantedCell.textContent = `${granted} (avail: ${available})`;
    row.appendChild(grantedCell);

    // completed
    const completedCell = document.createElement("td");
    completedCell.textContent = p.completed ? "Yes" : "No";
    row.appendChild(completedCell);

    // reward
    const rewardCell = document.createElement("td");
    rewardCell.textContent =
      p.reward === 25
        ? "£25 Champions"
        : p.reward === 10
        ? "£10 Champions"
        : "—";
    row.appendChild(rewardCell);

    // actions
    const actionsCell = document.createElement("td");
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.className = "btn btn-secondary btn-small";
    resetBtn.addEventListener("click", () => resetPlayer(p.email, p.area));

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "btn btn-danger btn-small";
    deleteBtn.addEventListener("click", () => deletePlayer(p.email, p.area));

    actionsCell.appendChild(resetBtn);
    actionsCell.appendChild(deleteBtn);
    row.appendChild(actionsCell);

    playersTableBody.appendChild(row);
  });

  if (selectAllCheckbox) selectAllCheckbox.checked = false;
}

// ----- RESET / DELETE PLAYER -----
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
      showStatus(data.error || "Failed to reset player.", true);
      return;
    }

    showStatus(`Reset progress for ${email}.`);
    loadPlayersForArea();
  } catch (err) {
    console.error("Reset player error:", err);
    showStatus("Server error resetting player.", true);
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
      showStatus(data.error || "Failed to delete player.", true);
      return;
    }

    showStatus(`Deleted player ${email}.`);
    loadPlayersForArea();
  } catch (err) {
    console.error("Delete player error:", err);
    showStatus("Server error deleting player.", true);
  }
}

// ----- GRANT ROLLS -----
async function handleGrantRolls(toSelectedOnly) {
  const area = getSelectedArea();
  if (!area) {
    showStatus("Please select an area first.", true);
    return;
  }

  const count = parseInt(grantCountInput?.value || "0", 10);
  if (!Number.isInteger(count) || count === 0) {
    showStatus(
      "Enter a non-zero whole number of rolls to grant or remove.",
      true
    );
    return;
  }

  let emails;
  if (toSelectedOnly) {
    emails = getSelectedPlayerEmails();
    if (!emails.length) {
      showStatus("Select at least one player to grant rolls to.", true);
      return;
    }
  }

  showStatus("Updating rolls…");

  try {
    const res = await fetch(`${API}/admin/grant-rolls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminUsername: "admin",
        area,
        extraRolls: count,
        emails,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success !== true) {
      showStatus(data.error || "Failed to grant rolls.", true);
      return;
    }

    const affected = Array.isArray(data.updatedEmails)
      ? data.updatedEmails.length
      : 0;

    showStatus(`Updated rolls for ${affected} players in ${area}.`);
    loadPlayersForArea();
  } catch (err) {
    console.error("Grant rolls error:", err);
    showStatus("Server error granting rolls.", true);
  }
}

async function handleUndoGrant() {
  const area = getSelectedArea();
  if (!area) {
    showStatus("Please select an area first.", true);
    return;
  }

  if (!confirm(`Undo last rolls grant for ${area}?`)) return;

  showStatus("Undoing last grant…");

  try {
    const res = await fetch(`${API}/admin/undo-last-grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success !== true) {
      showStatus(data.error || "No grant history for this area.", true);
      return;
    }

    showStatus(`Undid last grant for ${area}.`);
    loadPlayersForArea();
  } catch (err) {
    console.error("Undo grant error:", err);
    showStatus("Server error undoing grant.", true);
  }
}

// ----- PRIZE CONFIG -----
async function loadPrizeConfig() {
  const area = getSelectedArea();
  if (!area || !prizeCountInput || !prizeStatusEl) return;

  try {
    const res = await fetch(
      `${API}/admin/prize-config?area=${encodeURIComponent(area)}`
    );

    if (!res.ok) {
      prizeCountInput.value = "0";
      prizeStatusEl.textContent = `Max £25 prizes for ${area}: 0.`;
      return;
    }

    const data = await res.json();
    const winners = data.winners ?? 0;

    prizeCountInput.value = String(winners);
    prizeStatusEl.textContent = `Max £25 Champions Points prizes allowed in ${area}: ${winners}.`;
  } catch (err) {
    console.error("Load prize config error:", err);
    prizeStatusEl.textContent = "Error loading prize settings.";
  }
}

async function savePrizeConfig() {
  const area = getSelectedArea();
  if (!area) {
    showStatus("Select an area before saving prize settings.", true);
    return;
  }

  if (!prizeCountInput) return;

  const count = parseInt(prizeCountInput.value || "0", 10);
  if (!Number.isInteger(count) || count < 0) {
    showStatus(
      "Enter a non-negative whole number for max £25 winners.",
      true
    );
    return;
  }

  showStatus("Saving prize settings…");

  try {
    const res = await fetch(`${API}/admin/prize-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, winners: count }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success !== true) {
      showStatus(data.error || "Failed to save prize settings.", true);
      return;
    }

    showStatus(`Saved max £25 winners (${count}) for ${area}.`);
    loadPrizeConfig();
  } catch (err) {
    console.error("Save prize config error:", err);
    showStatus("Server error saving prize settings.", true);
  }
}

// ----- SELECT ALL -----
function handleSelectAllToggle() {
  if (!playersTableBody || !selectAllCheckbox) return;
  const checked = selectAllCheckbox.checked;
  const checks = playersTableBody.querySelectorAll(
    "input[type='checkbox'][data-email]"
  );
  checks.forEach((cb) => (cb.checked = checked));
}

// ----- INIT -----
function initAdmin() {
  ensureLoggedIn();

  // track activity for idle timeout
  window.addEventListener("mousemove", touchAdminActivity);
  window.addEventListener("keydown", touchAdminActivity);
  window.addEventListener("click", touchAdminActivity);

  areaSelect?.addEventListener("change", () => {
    loadPlayersForArea();
    loadPrizeConfig();
  });

  grantEveryoneBtn?.addEventListener("click", () =>
    handleGrantRolls(false)
  );
  grantSelectedBtn?.addEventListener("click", () =>
    handleGrantRolls(true)
  );
  undoGrantBtn?.addEventListener("click", handleUndoGrant);

  prizeSaveBtn?.addEventListener("click", savePrizeConfig);

  selectAllCheckbox?.addEventListener("change", handleSelectAllToggle);

  if (getSelectedArea()) {
    loadPlayersForArea();
    loadPrizeConfig();
  } else {
    showStatus("Select an area to view players and prize settings.");
  }
}

document.addEventListener("DOMContentLoaded", initAdmin);
