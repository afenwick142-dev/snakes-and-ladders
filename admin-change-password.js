// admin-change-password.js

const BACKEND_BASE_URL =
  window.SNAKES_BACKEND_URL ||
const BACKEND_BASE_URL = "https://snakes-ladders-backend-github.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("admin-change-form");
  const button = document.getElementById("admin-change-button");
  const messageEl = document.getElementById("admin-change-message");

  if (!form || !button || !messageEl) {
    console.error("Admin change password elements not found in DOM.");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const currentPasswordInput = document.getElementById("current-password");
    const newPasswordInput = document.getElementById("new-password");

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;

    if (!currentPassword || !newPassword) {
      showMessage("Please fill in both fields.", "error");
      return;
    }

    button.disabled = true;
    showMessage("Updating password...", "info");

    try {
      const response = await fetch(
        `${BACKEND_BASE_URL}/admin/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        const msg =
          data && data.error
            ? data.error
            : "Unable to update password. Please try again.";
        showMessage(msg, "error");
        button.disabled = false;
        return;
      }

      showMessage("Password updated successfully.", "success");
      currentPasswordInput.value = "";
      newPasswordInput.value = "";
      button.disabled = false;
    } catch (err) {
      console.error("Error updating admin password:", err);
      showMessage("Server error while updating password.", "error");
      button.disabled = false;
    }
  });

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.classList.remove("error", "success");

    if (type === "error") {
      messageEl.classList.add("error");
    } else if (type === "success") {
      messageEl.classList.add("success");
    }
  }
});
