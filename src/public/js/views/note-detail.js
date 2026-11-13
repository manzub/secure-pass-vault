(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", async () => {
        const messageElement = document.getElementById("detailNoteMessage");
        const deleteButton = document.getElementById("detailDeleteButton");

        try {
            const status = await window.VaultWorkerClient.send("STATUS");

            if (status.stale) {
                messageElement.textContent = "Vault status changed. Please refresh.";
                return;
            }

            if (!status.unlocked) {
                window.VaultShell.showView("unlock")
                return;
            }

            messageElement.textContent = "Loading note...";

            // fetch and decrypt
            const entryId = window.location.pathname.split("/").pop();

            // create edit button
            document.getElementById("detailEditButton").href =
                `/vault/notes/${encodeURIComponent(entryId)}/edit`;

            const encryptedEntry = await window.VaultEntryClient.getEntry(entryId);

            const note = await window.VaultEntryClient.decryptEntry(encryptedEntry);

            if (note.type !== "note") {
                throw new Error("Requested entry is not a note");
            }

            document.getElementById("detailNoteTitle").textContent =
                note.title || "Untitled";

            document.getElementById("detailNoteContent").textContent =
                note.content || "";

            messageElement.textContent = "";

            // delete button
            deleteButton.disabled = false;
            
            deleteButton.addEventListener("click", async () => {
                const confirmed = window.confirm(
                    "Permanently delete this note? This action cannot be undone."
                );

                if (!confirmed) return;

                deleteButton.disabled = true;
                messageElement.textContent = "Deleting note...";

                try {
                    await window.VaultEntryClient.deleteEntry(entryId);

                    window.VaultShell.showView("unlock");
                } catch (error) {
                    messageElement.textContent =
                        error.message || "Unable to delete note.";

                    deleteButton.disabled = false;
                }
            });

        } catch (error) {
            messageElement.textContent = "Unable to load note.";
        }
    });
})();