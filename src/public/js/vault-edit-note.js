(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", async () => {
        const titleInput = document.getElementById("noteTitle");
        const contentInput = document.getElementById("noteContent");
        const saveButton = document.getElementById("saveNoteButton");
        const messageElement = document.getElementById("noteMessage");
        const cancelLink = document.getElementById("cancelEditLink");

        saveButton.disabled = true;

        const pathParts = window.location.pathname.split("/");
        const entryId = pathParts[pathParts.length - 2];

        cancelLink.href = `/vault/notes/${encodeURIComponent(entryId)}`;

        try {
            const status = await window.VaultWorkerClient.send("STATUS");

            if (status.stale) {
                messageElement.textContent = "Vault status changed. Please refresh.";
                return;
            }

            if (!status.unlocked) {
                window.location.replace("/vault/unlock");
                return;
            }

            messageElement.textContent = "Loading note...";

            const encryptedEntry = await window.VaultEntryClient.getEntry(entryId);
            const note = await window.VaultEntryClient.decryptEntry(encryptedEntry);

            if (note.type !== "note") {
                throw new Error("Requested entry is not a note");
            }

            titleInput.value = note.title || "";
            contentInput.value = note.content || "";

            messageElement.textContent = "";
            saveButton.disabled = false;

        } catch (error) {
            messageElement.textContent = "Unable to load note for editing.";
        }

        // update form submit
        const form = document.getElementById("editNoteForm");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

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

                form.reset();

                window.location.replace(
                    `/vault/notes/${encodeURIComponent(entryId)}`
                );

            } catch (error) {
                messageElement.textContent = error.message || "Unable to update note.";
                saveButton.disabled = false;
            }
        });
    });
})();