// admin.js

const BACKEND_BASE_URL =
  window.SNAKES_BACKEND_URL ||
  "https://snakes-ladders-backend-github.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  // Sections
  const adminLoginSection = document.getElementById("adminLoginSection");
  const adminChangePasswordSection = document.getElementById(
    "adminChangePasswordSection"
  );
  const adminPanelSection = document.getElementById("adminPanelSection");

  // Login controls
  const adminPasswordInput = document.getElementById("adminPasswordInput");
  const btnAdminLogin = document.getElementById("btnAdminLogin");
  const adminLoginStatus = document.getElementById("adminLoginStatus");
  const btnShowChangePassword = document.getElementById(
    "btnShowChangePassword"
  );

  // Change password controls (inline on admin.html)
  const adminNewPasswordInput = document.getElementById(
    "adminNewPasswordInput"
  );
  const btnChangePassword = document.getElementById("btnChangePassword");
  const adminChangePasswordStatus = document.getElementById(
    "adminChangePasswordStatus"
  );
  const btnCancelPasswordChange = document.getElementById(
    "btnCancelPasswordChange"
  );

  // Panel controls
  const swRegionSelect = document.getElementById("swRegionSelect");
  const extraRollsInput = document.getElementById("extraRollsInput");
  const btnGrantRollsArea = document.getElementById("btnGrantRollsArea");
  const btnGrantRollsSelected = document.getElementById(
    "btnGrantRollsSelected"
  );
  const btnUndoLastGrant = document.getElementById("btnUndoLastGrant");
  const grantStatus = document.getElementById("grantStatus");

  const btnLoadUsers = document.getElementById("btnLoadUsers");
  const usersForLabel = document.getElementById("usersForLabel");
  const playersTableBody = document.getElementById("playersTableBody");
  const usersStatus = document.getElementById("usersStatus");
  const selectAllUsersCheckbox = document.getElementById("selectAllUsers");

  // Prize settings
  const prize25Input = document.getElementById("prize25Input");
  const btnSavePrizes = document.getElementById("btnSavePrizes");
  const prizeStatus = document.getElementById("prizeStatus");

  let currentAdminPassword = "";
  let currentSW = swRegionSelect ? swRegionSelect.value : "SW1";

  // { type: 'area' | 'emails', area, emails?, count }
  let lastGrantAction = null;

  // ---------- Helpers ----------

  function show(el) {
    if (!el) return;
    el.classList.remove("hidden");
  }

  function hide(el) {
    if (!el) return;
    el.classList.add("hidden");
  }

  function setStatus(el, msg, timeout = 3000) {
    if (!el) return;
    el.textContent = msg;
    if (timeout) {
      setTimeout(() => {
        if (el.textContent === msg) el.textContent = "";
      }, timeout);
    }
  }

  function ensureLoggedIn(statusEl) {
    if (!currentAdminPassword) {
      setStatus(statusEl, "Please log in as admin first.");
      return false;
    }
    return true;
  }

  function getSelectedEmails() {
    const emails = [];
    if (!playersTableBody) return emails;
    const checkboxes = playersTableBody.querySelectorAll(
      'input[type="checkbox"][data-email]:checked'
    );
    checkboxes.forEach((cb) => {
      const email = cb.getAttribute("data-email");
      if (email) emails.push(email);
    });
    return emails;
  }

  function updateUsersLabel(count) {
    if (!usersForLabel) return;
    usersForLabel.textContent = `Players in ${currentSW} (${count || 0})`;
  }

  // ---------- Login & password ----------

  async function handleAdminLogin() {
    const pwd = adminPasswordInput.value.trim();
    if (!pwd) {
      setStatus(adminLoginStatus, "Please enter the admin password.");
      return;
    }

    try {
      // DB-based /admin/login: expects username + password
      const res = await fetch(`${BACKEND_BASE_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: pwd }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !data.success) {
        setStatus(
          adminLoginStatus,
          (data && (data.error || data.message)) ||
            "Failed to verify admin password.",
          4000
        );
        return;
      }

      currentAdminPassword = pwd;
      setStatus(adminLoginStatus, "Admin login successful.", 2000);

      // Show panel
      hide(adminLoginSection);
      hide(adminChangePasswordSection);
      show(adminPanelSection);

      // Immediately load users for current area
      await loadUsersForArea();
    } catch (err) {
      console.error("Admin login error:", err);
      setStatus(
        adminLoginStatus,
        "Error logging in. Please try again.",
        4000
      );
    }
  }

  async function handleInlineChangePassword() {
    const newPwd = adminNewPasswordInput.value.trim();

    if (!newPwd) {
      setStatus(
        adminChangePasswordStatus,
        "Please enter a new admin password."
      );
      return;
    }

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/admin/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentAdminPassword || "unknown",
          newPassword: newPwd,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !data.success) {
        setStatus(
          adminChangePasswordStatus,
          (data && (data.error || data.message)) ||
            "Unable to change admin password. Check current password.",
          6000
        );
        return;
      }

      currentAdminPassword = newPwd;
      setStatus(
        adminChangePasswordStatus,
        "Admin password changed successfully.",
        3000
      );
      adminNewPasswordInput.value = "";
    } catch (err) {
      console.error("Change password error:", err);
      setStatus(
        adminChangePasswordStatus,
        "Error changing password. Please try again.",
        4000
      );
    }
  }

  // ---------- Users table rendering ----------

  function renderUsersTable(users) {
    if (!playersTableBody) return;
    playersTableBody.innerHTML = "";

    users.forEach((u) => {
      const tr = document.createElement("tr");

      const email = u.email || "";
      const area = u.area || currentSW;
      const pos = u.position ?? 0;
      const used = u.rolls_used ?? 0;
      const granted = u.rolls_granted ?? 0;
      const completed = !!u.completed;
      const reward = u.reward;

      const tdCheck = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.setAttribute("data-email", email);
      tdCheck.appendChild(cb);

      const tdName = document.createElement("td");
      tdName.textContent = email || "";

      const tdSW = document.createElement("td");
      tdSW.textContent = area;

      const tdPos = document.createElement("td");
      tdPos.textContent = pos;

      const tdUsed = document.createElement("td");
      tdUsed.textContent = used;

      const tdGranted = document.createElement("td");
      tdGranted.textContent = granted;

      const tdCompleted = document.createElement("td");
      tdCompleted.textContent = completed ? "Yes" : "No";

      const tdReward = document.createElement("td");
      if (reward && reward > 0) {
        tdReward.textContent = `£${reward}`;
      } else {
        tdReward.textContent = "–";
      }

      const tdActions = document.createElement("td");
      const btnAddRolls = document.createElement("button");
      btnAddRolls.className = "btn-small";
      btnAddRolls.textContent = "+ rolls";
      btnAddRolls.addEventListener("click", () => {
        const extra = parseInt(
          prompt(`How many extra rolls for ${email}?`, "1") || "0",
          10
        );
        if (!extra || isNaN(extra) || extra <= 0) return;
        grantRollsToEmails([email], extra);
      });

      tdActions.appendChild(btnAddRolls);

      tr.appendChild(tdCheck);
      tr.appendChild(tdName);
      tr.appendChild(tdSW);
      tr.appendChild(tdPos);
      tr.appendChild(tdUsed);
      tr.appendChild(tdGranted);
      tr.appendChild(tdCompleted);
      tr.appendChild(tdReward);
      tr.appendChild(tdActions);

      playersTableBody.appendChild(tr);
    });

    if (selectAllUsersCheckbox) {
      selectAllUsersCheckbox.checked = false;
    }

    updateUsersLabel(users.length);
  }

  // ---------- Backend calls ----------

  async function loadUsersForArea() {
    if (!ensureLoggedIn(usersStatus)) return;

    try {
      const url = new URL(`${BACKEND_BASE_URL}/players`);
      url.searchParams.set("area", currentSW);

      const res = await fetch(url.toString());
      const data = await res.json().catch(() => null);

      if (!res.ok || !Array.isArray(data)) {
        setStatus(
          usersStatus,
          (data && (data.error || data.message)) || "Failed to load users.",
          4000
        );
        return;
      }

      const users = data;
      renderUsersTable(users);
      setStatus(
        usersStatus,
        `Loaded ${users.length} player(s) for ${currentSW}.`,
        3000
      );
    } catch (err) {
      console.error("Load users error:", err);
      setStatus(usersStatus, "Error loading users.", 4000);
    }
  }

  async function grantRollsToArea(extraRolls) {
    if (!ensureLoggedIn(grantStatus)) return;

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/grant-rolls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: currentSW,
          count: extraRolls,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !data.success) {
        setStatus(
          grantStatus,
          (data && (data.error || data.message)) ||
            "Error granting rolls to area.",
          4000
        );
        return;
      }

      setStatus(
        grantStatus,
        `Granted ${extraRolls} roll(s) to all players in ${currentSW}.`,
        4000
      );

      lastGrantAction = {
        type: "area",
        area: currentSW,
        count: extraRolls,
      };

      await loadUsersForArea();
    } catch (err) {
      console.error("grantRollsToArea error:", err);
      setStatus(grantStatus, "Error granting rolls to area.", 4000);
    }
  }

  async function grantRollsToEmails(emails, extraRolls) {
    if (!ensureLoggedIn(grantStatus)) return;
    if (!emails || !emails.length) return;

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/grant-rolls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          area: currentSW,
          count: extraRolls,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !data.success) {
        setStatus(
          grantStatus,
          (data && (data.error || data.message)) ||
            "Error granting rolls to selected players.",
          4000
        );
        return;
      }

      setStatus(
        grantStatus,
        `Granted ${extraRolls} roll(s) to ${emails.length} player(s).`,
        4000
      );

      lastGrantAction = {
        type: "emails",
        area: currentSW,
        emails,
        count: extraRolls,
      };

      await loadUsersForArea();
    } catch (err) {
      console.error("grantRollsToEmails error:", err);
      setStatus(
        grantStatus,
        "Error granting rolls to selected players.",
        4000
      );
    }
  }

  async function undoLastGrant() {
    if (!ensureLoggedIn(grantStatus)) return;
    if (!lastGrantAction) {
      setStatus(grantStatus, "No grant action to undo.", 3000);
      return;
    }

    try {
      if (lastGrantAction.type === "area") {
        const res = await fetch(`${BACKEND_BASE_URL}/grant-rolls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            area: lastGrantAction.area,
            count: -lastGrantAction.count,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            (data && (data.error || data.message)) ||
              "Failed to undo last area grant."
          );
        }
      } else if (lastGrantAction.type === "emails") {
        const res = await fetch(`${BACKEND_BASE_URL}/grant-rolls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emails: lastGrantAction.emails,
            area: lastGrantAction.area,
            count: -lastGrantAction.count,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            (data && (data.error || data.message)) ||
              "Failed to undo last selected-player grant."
          );
        }
      }

      lastGrantAction = null;
      setStatus(grantStatus, "Last grant action has been undone.", 4000);
      await loadUsersForArea();
    } catch (err) {
      console.error("undoLastGrant error:", err);
      setStatus(
        grantStatus,
        "Error undoing last grant action. Please try again.",
        4000
      );
    }
  }

  async function savePrizes() {
    if (!ensureLoggedIn(prizeStatus)) return;

    const raw = prize25Input.value.trim();
    const max25 = parseInt(raw, 10);

    if (!Number.isInteger(max25) || max25 < 0) {
      setStatus(
        prizeStatus,
        "Please enter a non-negative whole number for £25 winners.",
        4000
      );
      return;
    }

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/area/prize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: currentSW,
          count: max25,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !data.success) {
        setStatus(
          prizeStatus,
          (data && (data.error || data.message)) ||
            "Failed to save prize settings.",
          4000
        );
        return;
      }

      setStatus(
        prizeStatus,
        `Prize settings saved for ${currentSW}.`,
        4000
      );
    } catch (err) {
      console.error("savePrizes error:", err);
      setStatus(prizeStatus, "Error saving prize settings.", 4000);
    }
  }

  // ---------- Event wiring ----------

  if (btnAdminLogin) {
    btnAdminLogin.addEventListener("click", (e) => {
      e.preventDefault();
      handleAdminLogin();
    });
  }

  if (btnShowChangePassword) {
    btnShowChangePassword.addEventListener("click", () => {
      show(adminChangePasswordSection);
      hide(adminLoginSection);
      hide(adminPanelSection);
    });
  }

  if (btnCancelPasswordChange) {
    btnCancelPasswordChange.addEventListener("click", () => {
      hide(adminChangePasswordSection);
      show(adminLoginSection);
      hide(adminPanelSection);
    });
  }

  if (btnChangePassword) {
    btnChangePassword.addEventListener("click", (e) => {
      e.preventDefault();
      handleInlineChangePassword();
    });
  }

  if (btnLoadUsers) {
    btnLoadUsers.addEventListener("click", (e) => {
      e.preventDefault();
      loadUsersForArea();
    });
  }

  if (btnGrantRollsArea) {
    btnGrantRollsArea.addEventListener("click", (e) => {
      e.preventDefault();
      const raw = extraRollsInput.value.trim();
      const extra = parseInt(raw, 10);
      if (!Number.isInteger(extra) || extra <= 0) {
        setStatus(grantStatus, "Enter a positive whole number of rolls.", 3000);
        return;
      }
      grantRollsToArea(extra);
    });
  }

  if (btnGrantRollsSelected) {
    btnGrantRollsSelected.addEventListener("click", (e) => {
      e.preventDefault();
      const emails = getSelectedEmails();
      if (!emails.length) {
        setStatus(
          grantStatus,
          "Select at least one player to grant rolls.",
          3000
        );
        return;
      }
      const raw = extraRollsInput.value.trim();
      const extra = parseInt(raw, 10);
      if (!Number.isInteger(extra) || extra <= 0) {
        setStatus(grantStatus, "Enter a positive whole number of rolls.", 3000);
        return;
      }
      grantRollsToEmails(emails, extra);
    });
  }

  if (btnUndoLastGrant) {
    btnUndoLastGrant.addEventListener("click", (e) => {
      e.preventDefault();
      undoLastGrant();
    });
  }

  if (btnSavePrizes) {
    btnSavePrizes.addEventListener("click", (e) => {
      e.preventDefault();
      savePrizes();
    });
  }

  if (selectAllUsersCheckbox) {
    selectAllUsersCheckbox.addEventListener("change", () => {
      const checked = selectAllUsersCheckbox.checked;
      const checkboxes = playersTableBody.querySelectorAll(
        'input[type="checkbox"][data-email]'
      );
      checkboxes.forEach((cb) => {
        cb.checked = checked;
      });
    });
  }

  if (swRegionSelect) {
    swRegionSelect.addEventListener("change", () => {
      currentSW = swRegionSelect.value || "SW1";
      updateUsersLabel(0);
    });
  }
});
