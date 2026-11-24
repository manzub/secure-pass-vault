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
        let saveGeneration = 0;

        function resetEditView() {
            loadGeneration++;
            saveGeneration++;

            currentEntryId = null;

            form.reset();

            titleInput.value = "";
            contentInput.value = "";

            saveButton.disabled = true;
            messageElement.textContent = "";
        }

        window.addEventListener("vault:note-edit", async (event) => {
            const entryId = event.detail?.entryId;
            if (!entryId) return;

            resetEditView();

            const generation = loadGeneration;

            messageElement.textContent = "Loading note...";

            try {
                const encryptedEntry = await window.VaultEntryClient.getEntry(entryId);

                if (generation !== loadGeneration) return;

                const note = await window.VaultEntryClient.decryptEntry(encryptedEntry);

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

                resetEditView();

                console.error("Unable to load note:", error);
                messageElement.textContent = "Unable to load note.";
            }
        });

        window.addEventListener("vault:locked", () => {
            resetEditView();
        });

        window.addEventListener("vault:view-leaving", (event) => {
            if (event.detail?.from !== "editNote") return;

            resetEditView();
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!currentEntryId || saveButton.disabled) return;

            const entryId = currentEntryId;
            const title = titleInput.value.trim();
            const content = contentInput.value.trim();

            if (!title || !content) {
                messageElement.textContent = "Title and content are required.";
                return;
            }

            saveButton.disabled = true;
            messageElement.textContent = "Encrypting and saving changes...";

            const generation = ++saveGeneration;

            try {
                await window.VaultEntryClient.updateEntry(entryId, {
                    type: "note",
                    title,
                    content
                });

                if (generation !== saveGeneration) return;

                window.dispatchEvent(new CustomEvent("vault:entries-changed"));

                // Return to the updated note, not the dashboard.
                window.dispatchEvent(new CustomEvent("vault:note-selected", {
                    detail: { entryId }
                }));

            } catch (error) {
                if (generation !== saveGeneration) return;

                console.error("Unable to update note:", error);
                messageElement.textContent = "Unable to save changes.";
            } finally {
                if (generation === saveGeneration) {
                    saveButton.disabled = false;
                }
            }
        });
    });
})();