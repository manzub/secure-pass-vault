(function () {
    "use strict";

    let loadGeneration = 0;

    async function loadVaultEntries() {
        const generation = ++loadGeneration;

        const entriesContainer = document.getElementById("vaultEntries");

        // Clear previously rendered entries
        entriesContainer.replaceChildren();

        entriesContainer.textContent = "Loading entries...";

        try {
            const entries = await window.VaultEntryClient.getEntries();

            if (generation !== loadGeneration) return;

            if (entries.length === 0) {
                entriesContainer.textContent = "Your vault is empty.";
                return;
            }

            const decryptedEntries = await Promise.all(
                entries.map(entry => window.VaultEntryClient.decryptEntry(entry))
            );

            if (generation !== loadGeneration) return;

            entriesContainer.replaceChildren();

            for (const entry of decryptedEntries) {
                const entryElement = document.createElement("div");
                const titleElement = document.createElement("h3");
                const typeElement = document.createElement("p");
                const linkElement = document.createElement("button");

                linkElement.type = "button";
                linkElement.className = "vault-note-link";
                linkElement.textContent = entry.title || "Untitled";

                linkElement.addEventListener("click", () => {
                    window.dispatchEvent(new CustomEvent("vault:note-selected", {
                        detail: {
                            entryId: entry.entryId
                        }
                    }));
                });

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
            if (generation !== loadGeneration) return;

            entriesContainer.textContent = "Unable to load vault entries.";
            console.error("Vault entry loading failed:", error);
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        const statusElement = document.getElementById("vaultStatus");
        const lockButton = document.getElementById("lockVaultButton");
        const logoutButton = document.getElementById("logoutButton")

        // Register event listeners first
        window.addEventListener("vault:unlocked", async () => {
            statusElement.textContent = "Vault unlocked";
            await loadVaultEntries();
        });

        window.addEventListener("vault:locked", () => {
            loadGeneration++;
            document.getElementById("vaultEntries").replaceChildren();
        });

        window.addEventListener("vault:entries-changed", async () => {
            await loadVaultEntries();
        });

        lockButton.addEventListener("click", async () => {
            lockButton.disabled = true;

            try {
                const result = await window.VaultWorkerClient.send("LOCK");

                if (result.type !== "LOCK_RESULT" || result.unlocked !== false) {
                    throw new Error("Unable to confirm vault lock");
                }

                // clear hidden DOM contents
                window.dispatchEvent(new CustomEvent("vault:locked"));
                // clear html contents
                document.getElementById("vaultEntries").replaceChildren();

                window.VaultSync.notifyLocked();

                // redirect to unlock page
                statusElement.textContent = "Vault locked";
                window.VaultShell.showView("unlock");

            } catch (error) {
                console.error("Vault lock failed:", error);
                statusElement.textContent = "Unable to confirm vault lock";
            } finally {
                lockButton.disabled = false;
            }
        });

        logoutButton.addEventListener("click", async () => {
            logoutButton.disabled = true;

            // Clear plaintext immediately.
            window.dispatchEvent(new CustomEvent("vault:locked"));

            try {
                const lockResult = await window.VaultWorkerClient.send("LOCK");

                if (lockResult.type !== "LOCK_RESULT" ||
                    lockResult.unlocked !== false) {
                    throw new Error("Unable to confirm vault lock");
                }

                window.VaultSync.notifyLocked();

                const response = await fetch("/api/logout", {
                    method: "POST"
                });

                if (!response.ok) {
                    throw new Error("Logout failed");
                }

                window.VaultSync.notifyLoggedOut();
                window.location.replace("/login");

            } catch (error) {
                console.error("Logout failed:", error);
                logoutButton.disabled = false;
            }
        });

        // Check initial vault status LAST
        try {
            const result = await window.VaultWorkerClient.send("STATUS");

            if (result.stale) return;

            if (!result.unlocked) {
                window.VaultShell.showView("unlock");
                return;
            }

            window.VaultShell.showView("dashboard");
            statusElement.textContent = "Vault unlocked";

            await loadVaultEntries();

        } catch (error) {
            statusElement.textContent = "Unable to check vault status";
        }
    });
})();