(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const form = document.getElementById("editNoteForm");
        const titleInput = document.getElementById("editNoteTitle");
        const contentInput = document.getElementById("editNoteContent");
        const saveButton = document.getElementById("editNoteSaveButton");
        const messageElement = document.getElementById("editNoteMessage");

        if (!form) return;

        let currentEntryId = null;
        let loadGeneration = 0;

        window.addEventListener("vault:note-edit", async (event) => {
            const entryId = event.detail?.entryId;
            if (!entryId) return;

            const generation = ++loadGeneration;
            currentEntryId = null;

            form.reset();
            saveButton.disabled = true;
            messageElement.textContent = "Loading note...";

            try {
                const encryptedEntry =
                    await window.VaultEntryClient.getEntry(entryId);

                const note =
                    await window.VaultEntryClient.decryptEntry(encryptedEntry);

                // Ignore results from an older request.
                if (generation !== loadGeneration) return;

                if (note.type !== "note") {
                    throw new Error("Requested entry is not a note");
                }

                currentEntryId = entryId;
                titleInput.value = note.title || "";
                contentInput.value = note.content || "";

                messageElement.textContent = "";
                saveButton.disabled = false;

            } catch (error) {
                if (generation !== loadGeneration) return;

                messageElement.textContent =
                    error.message || "Unable to load note.";
            }
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!currentEntryId) return;

            const entryId = currentEntryId;
            const title = titleInput.value.trim();
            const content = contentInput.value.trim();

            if (!title || !content) {
                messageElement.textContent = "Title and content are required.";
                return;
            }

            saveButton.disabled = true;
            messageElement.textContent = "Encrypting and saving changes...";

            try {
                await window.VaultEntryClient.updateEntry(entryId, {
                    type: "note",
                    title,
                    content
                });

                currentEntryId = null;
                loadGeneration++;

                form.reset();
                messageElement.textContent = "";

                window.dispatchEvent(new CustomEvent("vault:entries-changed"));

                // Return to the updated note, not the dashboard.
                window.dispatchEvent(new CustomEvent("vault:note-selected", {
                    detail: { entryId }
                }));

            } catch (error) {
                messageElement.textContent =
                    error.message || "Unable to save changes.";
            } finally {
                saveButton.disabled = false;
            }
        });
    });
})();