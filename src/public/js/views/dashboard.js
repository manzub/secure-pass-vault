(function () {
    "use strict";

    let loadGeneration = 0;
    let searchableEntries = [];
    let securitySummary = null;
    let activeSecurityFilter = null;

    let entriesContainer;
    let searchInput;
    let activeFilter = "all";
    let activeSort = "name-asc";

    function renderVaultEntries() {
        const query = searchInput.value.trim().toLowerCase();

        const filteredEntries = searchableEntries.filter(entry => {
            const matchesSearch = entry.name.toLowerCase().includes(query);

            const matchesType = activeFilter === "all" || entry.type === activeFilter;

            let matchesSecurity = true;

            if (activeSecurityFilter === "reused") {
                matchesSecurity =
                    securitySummary?.reusedIds.has(entry.entryId) ?? false;
            }

            if (activeSecurityFilter === "weak") {
                matchesSecurity =
                    securitySummary?.weakIds.has(entry.entryId) ?? false;
            }

            return matchesSearch && matchesType && matchesSecurity;
        });

        filteredEntries.sort((a, b) => {
            switch (activeSort) {
                case "name-asc":
                    return a.name.localeCompare(b.name, undefined, {
                        sensitivity: "base"
                    });

                case "name-desc":
                    return b.name.localeCompare(a.name, undefined, {
                        sensitivity: "base"
                    });

                case "created-desc":
                    return new Date(b.createdAt) - new Date(a.createdAt);

                case "created-asc":
                    return new Date(a.createdAt) - new Date(b.createdAt);

                case "updated-desc":
                    return new Date(b.updatedAt) - new Date(a.updatedAt);

                case "updated-asc":
                    return new Date(a.updatedAt) - new Date(b.updatedAt);

                default:
                    return 0;
            }
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
            const websiteElement = document.createElement("p");

            const isPassword = entry.type === "password";

            if (isPassword && entry.website) {
                websiteElement.textContent = entry.website;
                websiteElement.className = "vault-entry-website";
            }

            if (entry.type === "password" && securitySummary?.reusedIds.has(entry.entryId)) {
                const warning = document.createElement("span");

                warning.textContent = "Reused password";
                warning.className = "text-amber-600 text-sm font-medium";

                entryElement.appendChild(warning);
            }

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

            if (["note", "password"].includes(entry.type)) {
                entryElement.appendChild(linkElement);
            } else {
                entryElement.appendChild(titleElement);
            }

            typeElement.textContent = entry.type || "Unknown";
            entryElement.appendChild(typeElement);

            if (isPassword && entry.website) {
                entryElement.appendChild(websiteElement);
            }

            entriesContainer.appendChild(entryElement);
        }
    }

    function renderSecurityOverview() {
        const summary = securitySummary;

        document.getElementById("securityTotalPasswords").textContent =
            summary?.totalPasswords ?? 0;

        document.getElementById("securityReusedPasswords").textContent =
            summary?.reusedCount ?? 0;

        document.getElementById("securityWeakPasswords").textContent =
            summary?.weakCount ?? 0;

        document.getElementById("securityStrongPasswords").textContent =
            summary?.strongCount ?? 0;
    }

    function renderSecurityFilterStatus() {
        const container = document.getElementById("securityFilterStatus");
        const label = document.getElementById("securityFilterLabel");

        const reusedButton = document.getElementById("filterReusedPasswords");
        const weakButton = document.getElementById("filterWeakPasswords");

        const isReused = activeSecurityFilter === "reused";
        const isWeak = activeSecurityFilter === "weak";

        container.classList.toggle("hidden", !activeSecurityFilter);
        container.classList.toggle("flex", Boolean(activeSecurityFilter));

        label.textContent = isReused
            ? "Showing reused passwords"
            : isWeak
                ? "Showing weak passwords"
                : "";

        reusedButton.classList.toggle("ring-2", isReused);
        reusedButton.classList.toggle("ring-amber-500", isReused);

        weakButton.classList.toggle("ring-2", isWeak);
        weakButton.classList.toggle("ring-red-500", isWeak);

        reusedButton.setAttribute("aria-pressed", String(isReused));
        weakButton.setAttribute("aria-pressed", String(isWeak));
    }

    async function loadVaultEntries() {
        const generation = ++loadGeneration;

        searchableEntries = [];
        securitySummary = null;
        activeSecurityFilter = null
        renderSecurityOverview();
        renderSecurityFilterStatus();

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

            const passwordEntries = decryptedEntries.map((payload, index) => ({
                entryId: entries[index].entryId,
                type: payload.type,
                password: payload.type === "password" ? payload.password : undefined
            }));

            securitySummary = VaultSecurity.analyse(passwordEntries);


            searchableEntries = decryptedEntries.map((entry, index) => {
                const isPassword = entry.type === "password";

                const metadata = entries[index]

                return {
                    entryId: metadata.entryId,
                    type: entry.type,
                    name: (
                        isPassword ? entry.name : entry.title
                    ) || "Untitled",
                    website: isPassword ? (entry.website || "") : "",
                    createdAt: metadata.createdAt,
                    updatedAt: metadata.updatedAt
                };
            });

            renderVaultEntries();
            renderSecurityOverview();

        } catch (error) {
            if (generation !== loadGeneration) return;

            searchableEntries = [];
            securitySummary = null;;

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
        const sortSelect = document.getElementById("vaultSort");


        searchInput = document.getElementById("vaultSearchInput");
        searchInput.addEventListener("input", () => {
            renderVaultEntries();
        });

        sortSelect.addEventListener("change", () => {
            activeSort = sortSelect.value;
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
            activeSort = "name-asc";
            sortSelect.value = activeSort;


            filterButtons.forEach(button => {
                button.setAttribute(
                    "aria-pressed",
                    String(button.dataset.filter === "all")
                );
            });

            securitySummary = null;
            activeSecurityFilter = null;
            renderSecurityOverview();
            renderSecurityFilterStatus();
            entriesContainer.replaceChildren();
        });

        window.addEventListener("vault:entries-changed", async () => {
            await loadVaultEntries();
        });

        // password security summary clickables
        document.getElementById("filterReusedPasswords")
            .addEventListener("click", () => {
                activeSecurityFilter =
                    activeSecurityFilter === "reused" ? null : "reused";

                renderVaultEntries();
                renderSecurityFilterStatus();
            });

        document.getElementById("filterWeakPasswords")
            .addEventListener("click", () => {
                activeSecurityFilter =
                    activeSecurityFilter === "weak" ? null : "weak";

                renderVaultEntries();
                renderSecurityFilterStatus();
            });

        document.getElementById("clearSecurityFilter")
            .addEventListener("click", () => {
                activeSecurityFilter = null;

                renderVaultEntries();
                renderSecurityFilterStatus();
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

            window.dispatchEvent(new CustomEvent("vault:locked"));
            window.VaultShell.showView("unlock");

            try {
                const result = await window.VaultWorkerClient.send("LOCK");

                if (result.type !== "LOCK_RESULT" || result.unlocked !== false) {
                    throw new Error("Unable to confirm vault lock");
                }

                window.VaultSync.notifyLocked();

                statusElement.textContent = "Vault locked";

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

            window.dispatchEvent(new CustomEvent("vault:unlocked"));

        } catch (error) {
            statusElement.textContent = "Unable to check vault status";
        }
    });
})();