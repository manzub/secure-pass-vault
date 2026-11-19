(function () {
    "use strict";

    let loadGeneration = 0;
    let searchableEntries = [];

    let entriesContainer;
    let searchInput;
    let activeFilter = "all";

    function renderVaultEntries() {
        const query = searchInput.value.trim().toLowerCase();

        const filteredEntries = searchableEntries.filter(entry => {
            const matchesSearch = entry.name.toLowerCase().includes(query);

            const matchesType = activeFilter === "all" || entry.type === activeFilter;

            return matchesSearch && matchesType
        });

        entriesContainer.replaceChildren();

        if (searchableEntries.length === 0) {
            entriesContainer.textContent = "Your vault is empty.";
            return;
        }

        if (filteredEntries.length === 0) {
            entriesContainer.textContent = "No matching entries found.";
            return;
        }

        for (const entry of filteredEntries) {
            const entryElement = document.createElement("div");
            const titleElement = document.createElement("h3");
            const typeElement = document.createElement("p");
            const linkElement = document.createElement("button");

            const isPassword = entry.type === "password";

            linkElement.type = "button";
            linkElement.className = "vault-note-link";

            linkElement.textContent = isPassword
                ? `🔑 ${entry.name}`
                : `📝 ${entry.name}`;

            linkElement.addEventListener("click", () => {
                const eventName = isPassword
                    ? "vault:password-selected"
                    : "vault:note-selected";

                window.dispatchEvent(
                    new CustomEvent(eventName, {
                        detail: { entryId: entry.entryId }
                    })
                );
            });

            titleElement.textContent = entry.name;
            typeElement.textContent = entry.type || "Unknown";

            entryElement.append(
                ["note", "password"].includes(entry.type)
                    ? linkElement
                    : titleElement,
                typeElement
            );

            entriesContainer.appendChild(entryElement);
        }
    }

    async function loadVaultEntries() {
        const generation = ++loadGeneration;

        searchableEntries = [];

        // Clear previously rendered entries
        entriesContainer.replaceChildren();
        entriesContainer.textContent = "Loading entries...";

        try {
            const entries = await window.VaultEntryClient.getEntries();

            if (generation !== loadGeneration) return;

            const decryptedEntries = await Promise.all(
                entries.map(entry => window.VaultEntryClient.decryptEntry(entry))
            );

            if (generation !== loadGeneration) return;

            searchableEntries = decryptedEntries.map(entry => {
                const isPassword = entry.type === "password";

                return {
                    entryId: entry.entryId,
                    type: entry.type,
                    name: (
                        isPassword ? entry.name : entry.title
                    ) || "Untitled"
                };
            });

            renderVaultEntries();

        } catch (error) {
            if (generation !== loadGeneration) return;

            searchableEntries = [];

            entriesContainer.textContent = "Unable to load vault entries.";
            console.error("Vault entry loading failed:", error);
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        entriesContainer = document.getElementById("vaultEntries");

        const statusElement = document.getElementById("vaultStatus");
        const lockButton = document.getElementById("lockVaultButton");
        const logoutButton = document.getElementById("logoutButton")
        const filterButtons = document.querySelectorAll("#vaultFilters [data-filter]");

        searchInput = document.getElementById("vaultSearchInput");
        searchInput.addEventListener("input", () => {
            renderVaultEntries();
        });

        // Register event listeners first
        window.addEventListener("vault:unlocked", async () => {
            statusElement.textContent = "Vault unlocked";
            await loadVaultEntries();
        });

        window.addEventListener("vault:locked", () => {
            loadGeneration++;

            searchableEntries = [];
            searchInput.value = "";
            activeFilter = "all";

            filterButtons.forEach(button => {
                button.setAttribute(
                    "aria-pressed",
                    String(button.dataset.filter === "all")
                );
            });

            entriesContainer.replaceChildren();
        });

        window.addEventListener("vault:entries-changed", async () => {
            await loadVaultEntries();
        });

        filterButtons.forEach(button => {
            button.addEventListener("click", () => {
                activeFilter = button.dataset.filter;

                filterButtons.forEach(filterButton => {
                    filterButton.setAttribute(
                        "aria-pressed",
                        String(filterButton === button)
                    );
                });

                renderVaultEntries();
            });
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