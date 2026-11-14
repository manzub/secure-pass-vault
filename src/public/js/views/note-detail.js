(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        let currentEntryId = null;

        const titleElement = document.getElementById("detailNoteTitle");
        const contentElement = document.getElementById("detailNoteContent");
        const messageElement = document.getElementById("detailNoteMessage");
        const deleteButton = document.getElementById("detailDeleteButton");
        const editButton = document.getElementById("detailEditButton");

        if (!titleElement || !contentElement || !messageElement) return;

        let loadGeneration = 0;

        window.addEventListener("vault:note-selected", async (event) => {
            const generation = ++loadGeneration;

            const entryId = event.detail.entryId;
            currentEntryId = entryId;

            titleElement.textContent = "";
            contentElement.textContent = "";
            messageElement.textContent = "Loading note...";

            deleteButton.disabled = true;
            editButton.disabled = true;

            try {
                const encryptedEntry =
                    await window.VaultEntryClient.getEntry(entryId);

                const note =
                    await window.VaultEntryClient.decryptEntry(encryptedEntry);

                if (note.type !== "note") {
                    throw new Error("Requested entry is not a note");
                }

                if (generation !== loadGeneration) return;

                titleElement.textContent = note.title || "Untitled";
                contentElement.textContent = note.content || "";

                messageElement.textContent = "";

                deleteButton.disabled = false;
                editButton.disabled = false;

            } catch (error) {
                if (generation !== loadGeneration) return;
                
                messageElement.textContent =
                    error.message || "Unable to load note.";
            }
        });

        window.addEventListener("vault:locked", () => {
            currentEntryId = null;
            loadGeneration++;

            titleElement.textContent = "";
            contentElement.textContent = "";
            messageElement.textContent = "";

            deleteButton.disabled = true;
            editButton.disabled = true;
        });

        // delete button
        deleteButton.addEventListener("click", async () => {
            if (!currentEntryId) return;

            const confirmed = window.confirm(
                "Permanently delete this note? This cannot be undone."
            );

            if (!confirmed) return;

            deleteButton.disabled = true;
            messageElement.textContent = "Deleting note...";

            try {
                await window.VaultEntryClient.deleteEntry(currentEntryId);

                currentEntryId = null;
                titleElement.textContent = "";
                contentElement.textContent = "";
                messageElement.textContent = "";

                window.dispatchEvent(new CustomEvent("vault:entries-changed"));
                window.VaultShell.showView("dashboard");

            } catch (error) {
                messageElement.textContent =
                    error.message || "Unable to delete note.";
                deleteButton.disabled = false;
            }
        });

        // edit button
        editButton.addEventListener("click", () => {
            if (!currentEntryId) return;

            window.dispatchEvent(new CustomEvent("vault:note-edit", {
                detail: {
                    entryId: currentEntryId
                }
            }));
        });
    });
})();