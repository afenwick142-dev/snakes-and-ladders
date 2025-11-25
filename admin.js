// admin.js

const BACKEND_BASE_URL = "https://snakes-ladders-backend-github.onrender.com";

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

  // Change password controls
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

  // { type: 'region'|'user'|'multi-users', swCode?, userId?, userIds?, extraRolls }
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

  function getSelectedUserIds() {
    const ids = [];
    if (!playersTableBody) return ids;
    const checkboxes = playersTableBody.querySelectorAll(
      'input[type="checkbox"][data-user-id]:checked'
    );
    checkboxes.forEach((cb) => {
      const id = parseInt(cb.getAttribute("data-user-id"), 10);
      if (!isNaN(id)) ids.push(id);
    });
    return ids;
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
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(
          adminLoginStatus,
          (data && data.error) || "Failed to verify admin password.",
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
      loadUsersForArea();
    } catch (err) {
      console.error("Admin login error:", err);
      setStatus(
        adminLoginStatus,
        "Error logging in. Please try again.",
        4000
      );
    }
  }

  async function handleChangePassword() {
    const newPwd = adminNewPasswordInput.value.trim();

    if (!newPwd) {
      setStatus(
        adminChangePasswordStatus,
        "Please enter a new admin password."
      );
      return;
    }

    // If backend is env-only, this will likely return an error message – we just display it.
    try {
      const res = await fetch(`${API_BASE}/api/admin/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentAdminPassword || "unknown",
          newPassword: newPwd,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(
          adminChangePasswordStatus,
          (data && data.error) ||
            "Backend does not allow changing the admin password here. Update ADMIN_PASSWORD in Render.",
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

      const tdCheck = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.setAttribute("data-user-id", u.user_id);
      tdCheck.appendChild(cb);

      const tdName = document.createElement("td");
      tdName.textContent = u.username || "";

      const tdSW = document.createElement("td");
      tdSW.textContent = u.sw_code || "";

      const tdPos = document.createElement("td");
      tdPos.textContent = u.current_position ?? 0;

      const tdUsed = document.createElement("td");
      tdUsed.textContent = u.rolls_used ?? 0;

      const tdGranted = document.createElement("td");
      tdGranted.textContent = u.rolls_granted ?? 0;

      const tdCompleted = document.createElement("td");
      tdCompleted.textContent = u.completed ? "Yes" : "No";

      const tdReward = document.createElement("td");
      if (u.reward_won && u.reward_won > 0) {
        tdReward.textContent = `£${u.reward_won}`;
      } else {
        tdReward.textContent = "–";
      }

      const tdActions = document.createElement("td");

      const btnAddRolls = document.createElement("button");
      btnAddRolls.className = "btn-small";
      btnAddRolls.textContent = "+ rolls";
      btnAddRolls.addEventListener("click", () => {
        const extra = parseInt(
          prompt("How many extra rolls for this player?", "1") || "0",
          10
        );
        if (!extra || isNaN(extra) || extra <= 0) return;
        grantRollsToUsers([u.user_id], extra);
      });

      const btnReset = document.createElement("button");
      btnReset.className = "btn-small secondary";
      btnReset.textContent = "Reset";
      btnReset.addEventListener("click", () => {
        if (
          confirm(
            `Reset game for ${u.username}? This will clear their position, rolls and reward.`
          )
        ) {
          resetGameForUser(u.user_id);
        }
      });

      const btnDelete = document.createElement("button");
      btnDelete.className = "btn-small danger";
      btnDelete.textContent = "Delete";
      btnDelete.addEventListener("click", () => {
        if (
          confirm(
            `Delete player ${u.username} and all their data? This cannot be undone.`
          )
        ) {
          deleteUser(u.user_id);
        }
      });

      tdActions.appendChild(btnAddRolls);
      tdActions.appendChild(btnReset);
      tdActions.appendChild(btnDelete);

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
      const url = new URL(`${API_BASE}/api/admin/users`);
      url.searchParams.set("password", currentAdminPassword);
      url.searchParams.set("swCode", currentSW);

      const res = await fetch(url.toString());
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(
          usersStatus,
          (data && data.error) || "Failed to load users.",
          4000
        );
        return;
      }

      const users = data && Array.isArray(data.users) ? data.users : [];
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
      const res = await fetch(`${API_BASE}/api/admin/grant-rolls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: currentAdminPassword,
          swCode: currentSW,
          extraRolls,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(
          grantStatus,
          (data && data.error) || "Error granting rolls to area.",
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
        type: "region",
        swCode: currentSW,
        extraRolls,
      };

      await loadUsersForArea();
    } catch (err) {
      console.error("grantRollsToArea error:", err);
      setStatus(grantStatus, "Error granting rolls to area.", 4000);
    }
  }

  async function grantRollsToUsers(userIds, extraRolls) {
    if (!ensureLoggedIn(grantStatus)) return;
    if (!userIds || !userIds.length) return;

    try {
      await Promise.all(
        userIds.map((userId) =>
          fetch(`${API_BASE}/api/admin/grant-rolls-user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              password: currentAdminPassword,
              userId,
              extraRolls,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => null);
              throw new Error(
                (data && data.error) ||
                  "Error granting rolls to one of the players."
              );
            }
          })
        )
      );

      setStatus(
        grantStatus,
        `Granted ${extraRolls} roll(s) to ${userIds.length} selected player(s).`,
        4000
      );

      lastGrantAction =
        userIds.length === 1
          ? { type: "user", userId: userIds[0], extraRolls }
          : { type: "multi-users", userIds: [...userIds], extraRolls };

      await loadUsersForArea();
    } catch (err) {
      console.error("grantRollsToUsers error:", err);
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
      setStatus(grantStatus, "No previous grant action to undo.", 3000);
      return;
    }

    try {
      if (lastGrantAction.type === "region") {
        const res = await fetch(`${API_BASE}/api/admin/grant-rolls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: currentAdminPassword,
            swCode: lastGrantAction.swCode,
            extraRolls: -lastGrantAction.extraRolls,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            (data && data.error) || "Failed to undo last area grant."
          );
        }
      } else if (lastGrantAction.type === "user") {
        const res = await fetch(`${API_BASE}/api/admin/grant-rolls-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: currentAdminPassword,
            userId: lastGrantAction.userId,
            extraRolls: -lastGrantAction.extraRolls,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            (data && data.error) || "Failed to undo last user grant."
          );
        }
      } else if (lastGrantAction.type === "multi-users") {
        await Promise.all(
          lastGrantAction.userIds.map((userId) =>
            fetch(`${API_BASE}/api/admin/grant-rolls-user`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                password: currentAdminPassword,
                userId,
                extraRolls: -lastGrantAction.extraRolls,
              }),
            }).then(async (res) => {
              if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(
                  (data && data.error) ||
                    "Failed to undo last multi-user grant."
                );
              }
            })
          )
        );
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

  async function resetGameForUser(userId) {
    if (!ensureLoggedIn(usersStatus)) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/reset-game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: currentAdminPassword,
          userId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(
          usersStatus,
          (data && data.error) || "Failed to reset player game.",
          4000
        );
        return;
      }

      setStatus(usersStatus, "Game reset for player.", 3000);
      await loadUsersForArea();
    } catch (err) {
      console.error("resetGameForUser error:", err);
      setStatus(usersStatus, "Error resetting game.", 4000);
    }
  }

  async function deleteUser(userId) {
    if (!ensureLoggedIn(usersStatus)) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/delete-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: currentAdminPassword,
          userId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(
          usersStatus,
          (data && data.error) || "Failed to delete player.",
          4000
        );
        return;
      }

      setStatus(usersStatus, "Player deleted.", 3000);
      await loadUsersForArea();
    } catch (err) {
      console.error("deleteUser error:", err);
      setStatus(usersStatus, "Error deleting player.", 4000);
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
      const res = await fetch(`${API_BASE}/api/admin/prizes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: currentAdminPassword,
          swCode: currentSW,
          max25,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(
          prizeStatus,
          (data && data.error) || "Failed to save prize settings.",
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
      show(adminLoginSection);
      hide(adminChangePasswordSection);
      hide(adminPanelSection);
    });
  }

  if (btnChangePassword) {
    btnChangePassword.addEventListener("click", (e) => {
      e.preventDefault();
      handleChangePassword();
    });
  }

  if (swRegionSelect) {
    swRegionSelect.addEventListener("change", () => {
      currentSW = swRegionSelect.value;
      updateUsersLabel(0);
      if (playersTableBody) playersTableBody.innerHTML = "";
      if (usersStatus) usersStatus.textContent = "";
    });
  }

  if (btnLoadUsers) {
    btnLoadUsers.addEventListener("click", () => loadUsersForArea());
  }

  if (btnGrantRollsArea) {
    btnGrantRollsArea.addEventListener("click", () => {
      const extra = parseInt(extraRollsInput.value, 10) || 0;
      if (!extra || extra <= 0) {
        setStatus(grantStatus, "Enter a positive number of rolls.", 3000);
        return;
      }

      const selectedIds = getSelectedUserIds();
      if (selectedIds.length > 0) {
        grantRollsToUsers(selectedIds, extra);
      } else {
        grantRollsToArea(extra);
      }
    });
  }

  if (btnUndoLastGrant) {
    btnUndoLastGrant.addEventListener("click", () => undoLastGrant());
  }

  if (btnSavePrizes) {
    btnSavePrizes.addEventListener("click", () => savePrizes());
  }

  if (selectAllUsersCheckbox && playersTableBody) {
    selectAllUsersCheckbox.addEventListener("change", () => {
      const checked = selectAllUsersCheckbox.checked;
      const checkboxes = playersTableBody.querySelectorAll(
        'input[type="checkbox"][data-user-id]'
      );
      checkboxes.forEach((cb) => {
        cb.checked = checked;
      });
    });
  }

  // Initial label
  updateUsersLabel(0);
});

