(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const form = document.getElementById("createNoteForm");
        const titleInput = document.getElementById("createNoteTitle");
        const contentInput = document.getElementById("createNoteContent");
        const saveButton = document.getElementById("createNoteSaveButton");
        const messageElement = document.getElementById("createNoteMessage");

        if (!form) return;

        let saveGeneration = 0;

        function resetCreateView() {
            saveGeneration++;

            form.reset();

            titleInput.value = "";
            contentInput.value = "";

            messageElement.textContent = "";
            saveButton.disabled = false;
        }

        window.addEventListener("vault:locked", () => {
            resetCreateView();
        });

        window.addEventListener("vault:view-leaving", (event) => {
            if (event.detail?.from !== "createNote") return;

            resetCreateView();
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (saveButton.disabled) return;

            const title = titleInput.value.trim();
            const content = contentInput.value.trim();

            if (!title || !content) {
                messageElement.textContent = "Title and content are required.";
                return;
            }

            saveButton.disabled = true;
            messageElement.textContent = "Encrypting and saving note...";

            const generation = ++saveGeneration;

            try {
                await window.VaultEntryClient.createEntry({
                    type: "note",
                    title,
                    content
                });

                if (generation !== saveGeneration) return;

                window.dispatchEvent(new CustomEvent("vault:entries-changed"));

                window.VaultShell.showView("dashboard");

            } catch (error) {
                if (generation !== saveGeneration) return;

                console.error("Unable to create note:", error);
                messageElement.textContent = "Unable to save note.";
            } finally {
                if (generation === saveGeneration) {
                    saveButton.disabled = false;
                }
            }
        });
    });
})();