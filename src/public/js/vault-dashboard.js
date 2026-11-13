(function () {
    "use strict";

    async function loadVaultEntries() {
        const entriesContainer = document.getElementById("vaultEntries");

        // Clear previously rendered entries
        entriesContainer.replaceChildren();

        entriesContainer.textContent = "Loading entries...";

        try {
            const entries = await window.VaultEntryClient.getEntries();

            if (entries.length === 0) {
                entriesContainer.textContent = "Your vault is empty.";
                return;
            }

            const decryptedEntries = await Promise.all(
                entries.map(entry => window.VaultEntryClient.decryptEntry(entry))
            );

            entriesContainer.replaceChildren();

            for (const entry of decryptedEntries) {
                const entryElement = document.createElement("div");
                const titleElement = document.createElement("h3");
                const typeElement = document.createElement("p");
                const linkElement = document.createElement("a");

                linkElement.href = `/vault/notes/${encodeURIComponent(entry.entryId)}`;
                linkElement.textContent = entry.title || "Untitled";

                titleElement.textContent = entry.title || "Untitled";
                typeElement.textContent = entry.type || "Unknown";

                if (entry.type === "note") {
                    entryElement.append(linkElement, typeElement);
                } else {
                    entryElement.append(titleElement, typeElement);
                }
                entriesContainer.appendChild(entryElement);
            }

        } catch (error) {
            entriesContainer.textContent = "Unable to load vault entries.";
            console.error("Vault entry loading failed:", error.message);
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        const statusElement = document.getElementById("vaultStatus");

        window.addEventListener("vault:unlocked", async () => {
            try {
                await loadVaultEntries();
            } catch (error) {
                console.error("Unable to load vault entries:", error);
            }
        });

        window.addEventListener("vault:entries-changed", async () => {
            try {
                await loadVaultEntries();
            } catch (error) {
                console.error("Unable to refresh vault entries:", error);
            }
        });

        try {
            const result = await window.VaultWorkerClient.send("STATUS");

            if (result.stale) {
                statusElement.textContent = "Vault status changed. Please refresh.";
                return;
            }

            if (!result.unlocked) {
                window.VaultShell.showView("unlock");
                return;
            }

            window.VaultShell.showView("dashboard");

            statusElement.textContent = "Vault unlocked";
            await loadVaultEntries()

        } catch (error) {
            statusElement.textContent = "Unable to check vault status";
        }

        // USERS LOCK VAULT
        const lockButton = document.getElementById("lockVaultButton");

        lockButton.addEventListener("click", async () => {
            lockButton.disabled = true;

            try {
                const result = await window.VaultWorkerClient.send("LOCK");

                if (result.type !== "LOCK_RESULT" || result.unlocked !== false) {
                    throw new Error("Unable to confirm vault lock");
                }

                const entriesContainer = document.getElementById("vaultEntries");

                entriesContainer.replaceChildren();
                statusElement.textContent = "Vault locked";

                window.VaultShell.showView("unlock");

            } catch (error) {
                console.error("Vault lock failed:", error);
                statusElement.textContent = "Unable to confirm vault lock";
                lockButton.disabled = false;
            }
        });
    });
})();