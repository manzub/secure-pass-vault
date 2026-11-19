"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("editPasswordForm");

    const name = document.getElementById("editPasswordName");
    const username = document.getElementById("editPasswordUsername");
    const password = document.getElementById("editPasswordValue");
    const website = document.getElementById("editPasswordWebsite");
    const notes = document.getElementById("editPasswordNotes");

    const message = document.getElementById("editPasswordMessage");
    const cancelButton = document.getElementById("editPasswordCancelButton");
    const saveButton = document.getElementById("editPasswordSaveButton");


    if (!form) return;

    let saveGeneration = 0;
    let currentEntryId = null;
    let loadGeneration = 0;

    function clearForm() {
        currentEntryId = null;
        form.reset();
        message.textContent = "";
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!currentEntryId) return;

        const entryId = currentEntryId;
        const generation = loadGeneration;
        const saveToken = ++saveGeneration;

        const payload = {
            type: "password",
            name: name.value.trim(),
            username: username.value.trim(),
            password: password.value,
            website: website.value.trim(),
            notes: notes.value.trim()
        };

        if (!payload.name || !payload.password) {
            message.textContent = "Name and password are required.";
            return;
        }

        saveButton.disabled = true;
        message.textContent = "Saving changes...";

        try {
            await VaultEntryClient.updateEntry(entryId, payload);

            if (
                generation !== loadGeneration ||
                saveToken !== saveGeneration
            ) return;

            message.textContent = "";

            // Notify the dashboard that its entries have changed.
            window.dispatchEvent(
                new CustomEvent("vault:entries-changed")
            );

            // Clear the edit form before leaving.
            loadGeneration++;
            clearForm();

            // Reload the updated password in the detail view.
            window.dispatchEvent(
                new CustomEvent("vault:password-selected", {
                    detail: { entryId }
                })
            );

        } catch (error) {
            if (
                generation !== loadGeneration ||
                saveToken !== saveGeneration
            ) return;

            console.error("Unable to update password:", error);
            message.textContent = "Unable to save changes.";

        } finally {
            if (saveToken === saveGeneration) {
                saveButton.disabled = false;
            }
        }
    });

    window.addEventListener("vault:password-edit", async (event) => {
        const generation = ++loadGeneration;
        const entryId = event.detail?.entryId;
        
        saveGeneration++;
        saveButton.disabled = false;
        
        clearForm();

        if (!entryId) return;


        currentEntryId = entryId;
        message.textContent = "Loading password...";

        VaultShell.showView("editPassword");

        try {
            const entry = await VaultEntryClient.getEntry(entryId);

            if (generation !== loadGeneration) return;

            const payload = await VaultEntryClient.decryptEntry(entry);

            if (generation !== loadGeneration) return;

            if (payload.type !== "password") {
                throw new Error("Invalid password entry");
            }

            name.value = payload.name ?? "";
            username.value = payload.username ?? "";
            password.value = payload.password ?? "";
            website.value = payload.website ?? "";
            notes.value = payload.notes ?? "";

            message.textContent = "";

        } catch (error) {
            if (generation !== loadGeneration) return;

            clearForm();
            message.textContent = "Unable to load password.";
        }
    });

    cancelButton.addEventListener("click", () => {
        if (!currentEntryId) return;

        const entryId = currentEntryId;

        saveGeneration++;
        saveButton.disabled = false;

        loadGeneration++;
        clearForm();

        window.dispatchEvent(
            new CustomEvent("vault:password-selected", {
                detail: { entryId }
            })
        );
    });

    window.addEventListener("vault:locked", () => {
        saveGeneration++;
        loadGeneration++;
        saveButton.disabled = false;
        clearForm();
    });
});