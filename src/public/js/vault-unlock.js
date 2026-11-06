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

    async function unlockVault(unlockSecret) {
        const settings = await fetchVaultSettings();

        // Validate the supported cryptographic configuration
        if (
            settings.cryptoVersion !== 1 ||
            settings.kdf?.algorithm !== "argon2id" ||
            settings.kdf.iterations !== 3 ||
            settings.kdf.parallelism !== 1 ||
            settings.kdf.memorySize !== 65536 ||
            settings.kdf.hashLength !== 32
        ) {
            throw new Error("Unsupported vault encryption configuration");
        }

        const vaultMetadata = {
            salt: VaultCrypto.base64ToArrayBuffer(settings.salt),
            iv: VaultCrypto.base64ToArrayBuffer(settings.wrapIv),
            wrappedKey: VaultCrypto.base64ToArrayBuffer(settings.wrappedVaultKey)
        };

        return VaultKeyDerivation.unlockVault(unlockSecret, vaultMetadata);
    }

    const VaultUnlock = {
        fetchVaultSettings,
        unlockVault
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
                    const vaultKey = await unlockVault(unlockSecret);

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