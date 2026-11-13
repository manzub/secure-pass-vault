(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const form = document.getElementById("createNoteForm");
        const titleInput = document.getElementById("createNoteTitle");
        const contentInput = document.getElementById("createNoteContent");
        const saveButton = document.getElementById("createNoteSaveButton");
        const messageElement = document.getElementById("createNoteMessage");

        if (!form) return;

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
                messageElement.textContent = "";

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