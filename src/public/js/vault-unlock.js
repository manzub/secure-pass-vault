(function () {
    "use strict";

    const VaultCrypto = typeof window !== "undefined"
        ? window.VaultCrypto
        : require("./crypto");

    const VaultKeyDerivation = typeof window !== "undefined"
        ? window.VaultKeyDerivation
        : require("./key-derivation");

    async function fetchVaultSettings() {
        const response = await fetch("/api/vault/settings", {
            method: "GET",
            credentials: "same-origin"
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("Vault has not been initialised");
            }

            if (response.status === 401) {
                throw new Error("Authentication required");
            }

            throw new Error("Unable to retrieve vault settings");
        }

        return response.json();
    }

    async function unlockVaultWithWorker(unlockSecret) {
        const settings = await fetchVaultSettings();

        const result = await window.VaultWorkerClient.send("UNLOCK", {
            unlockSecret,
            settings
        });

        if (!result.success) {
            throw new Error(result.message || "Unable to unlock vault");
        }

        return result;
    }

    const VaultUnlock = {
        fetchVaultSettings,
        unlockVaultWithWorker
    };

    if (typeof window !== "undefined") {
        document.addEventListener("DOMContentLoaded", () => {
            const form = document.getElementById("vaultUnlockForm");
            if (!form) return;

            const secretInput = document.getElementById("unlockSecret");
            const unlockButton = document.getElementById("unlockButton");
            const unlockMessage = document.getElementById("unlockMessage");

            form.addEventListener("submit", async (event) => {
                event.preventDefault();

                const unlockSecret = secretInput.value;

                unlockButton.disabled = true;
                unlockMessage.textContent = "Unlocking your vault...";

                try {
                    await unlockVaultWithWorker(unlockSecret);

                    secretInput.value = "";

                    unlockMessage.textContent = "Vault unlocked successfully";

                    // Next step: retain vaultKey in an in-memory vault session.

                } catch (error) {
                    unlockMessage.textContent =
                        error.message === "Vault has not been initialised"
                            ? error.message
                            : "Unable to unlock vault. Check your secret and try again.";
                } finally {
                    unlockButton.disabled = false;
                }
            });
        });
    }

    if (typeof window !== "undefined") {
        window.VaultUnlock = VaultUnlock;
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = VaultUnlock;
    }
})();