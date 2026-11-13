(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", async () => {
        const messageElement = document.getElementById("noteMessage");
        const deleteButton = document.getElementById("deleteNoteButton");

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

            // fetch and decrypt
            const entryId = window.location.pathname.split("/").pop();

            // create edit button
            document.getElementById("editNoteLink").href =
                `/vault/notes/${encodeURIComponent(entryId)}/edit`;

            const encryptedEntry = await window.VaultEntryClient.getEntry(entryId);

            const note = await window.VaultEntryClient.decryptEntry(encryptedEntry);

            if (note.type !== "note") {
                throw new Error("Requested entry is not a note");
            }

            document.getElementById("noteTitle").textContent =
                note.title || "Untitled";

            document.getElementById("noteContent").textContent =
                note.content || "";

            messageElement.textContent = "";

            // delete button 
            const deleteButton = document.getElementById("deleteNoteButton");
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

                    window.location.replace("/vault");
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