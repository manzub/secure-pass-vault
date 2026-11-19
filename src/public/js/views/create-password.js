"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("createPasswordForm");
    const saveButton = document.getElementById("createPasswordSaveButton");
    const message = document.getElementById("createPasswordMessage");

    if (!form) return;

    let saveGeneration = 0;

    document.addEventListener("vault:locked", () => {
        saveGeneration++;
        form.reset();
        message.textContent = "";
        saveButton.disabled = false;
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const generation = ++saveGeneration;

        const payload = {
            type: "password",
            name: document.getElementById("passwordName").value.trim(),
            username: document.getElementById("passwordUsername").value.trim(),
            password: document.getElementById("passwordValue").value,
            website: document.getElementById("passwordWebsite").value.trim(),
            notes: document.getElementById("passwordNotes").value.trim()
        };

        if (!payload.name || !payload.password) {
            message.textContent = "Name and password are required.";
            return;
        }

        saveButton.disabled = true;
        message.textContent = "Saving password...";

        try {
            await VaultEntryClient.createEntry(payload);

            if (generation !== saveGeneration) return;

            form.reset();
            message.textContent = "";

            window.dispatchEvent(
                new CustomEvent("vault:entries-changed")
            );

            VaultShell.showView("dashboard");

        } catch (error) {
            console.error("Password creation failed:", error);

            if (generation !== saveGeneration) return;

            message.textContent = "Unable to save password.";

        } finally {
            if (generation === saveGeneration) {
                saveButton.disabled = false;
            }
        }
    });
});