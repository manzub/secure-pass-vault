(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", async () => {
        const messageElement = document.getElementById("noteMessage");
        const saveButton = document.getElementById("saveNoteButton");

        saveButton.disabled = true;

        try {
            const result = await window.VaultWorkerClient.send("STATUS");

            if (result.stale) {
                messageElement.textContent = "Vault status changed. Please refresh.";
                return;
            }

            if (!result.unlocked) {
                window.VaultShell.showView("unlock")
                return;
            }

            saveButton.disabled = false;

        } catch (error) {
            messageElement.textContent = "Unable to check vault status.";
        }

        // ADD NOTE ENTRY
        const form = document.getElementById("createNoteForm");
        const titleInput = document.getElementById("noteTitle");
        const contentInput = document.getElementById("noteContent");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const title = titleInput.value.trim();
            const content = contentInput.value.trim();

            if (!title || !content) {
                messageElement.textContent = "Title and content are required.";
                return;
            }

            saveButton.disabled = true;
            messageElement.textContent = "Encrypting and saving note...";

            try {
                await window.VaultEntryClient.createEntry({
                    type: "note",
                    title,
                    content
                });

                form.reset();

                window.dispatchEvent(new CustomEvent("vault:entries-changed"));
                window.VaultShell.showView("dashboard");
            } catch (error) {
                messageElement.textContent =
                    error.message || "Unable to save note.";
            } finally {
                saveButton.disabled = false;
            }
        });
    });
})();