(function () {
    "use strict";
    
    const VaultKeyDerivation = typeof window !== "undefined"
        ? window.VaultKeyDerivation
        : require("./key-derivation");

    const VaultCrypto = typeof window !== "undefined"
        ? window.VaultCrypto
        : require("./crypto");

    async function initialiseVault(unlockSecret) {
        const vaultSetup = await VaultKeyDerivation.setupVault(unlockSecret);

        const payload = {
            cryptoVersion: 1,
            salt: VaultCrypto.arrayBufferToBase64(vaultSetup.salt),
            wrapIv: VaultCrypto.arrayBufferToBase64(vaultSetup.iv),
            wrappedVaultKey: VaultCrypto.arrayBufferToBase64(vaultSetup.wrappedKey),
            kdf: vaultSetup.kdf
        }

        return { payload, vaultKey: vaultSetup.vaultKey }
    }

    async function saveVaultSettings(payload) {
        const response = await fetch('/api/vault/settings', {
            method: 'POST',
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify(payload)
        })

        const result = await response.json()

        if (!response.ok) {
            throw new Error(result.message || "Failed to initialise vault");
        }

        return result
    }

    const VaultSetup = {
        initialiseVault,
        saveVaultSettings
    }

    if (typeof window !== "undefined") {
        document.addEventListener("DOMContentLoaded", () => {
            const form = document.getElementById("vaultSetupForm");

            if (!form) return;

            form.addEventListener("submit", async (event) => {
                event.preventDefault();

                const unlockSecretInput = document.getElementById("unlockSecret");
                const confirmInput = document.getElementById("confirmUnlockSecret");
                const setupButton = document.getElementById("setupButton");
                const setupMessage = document.getElementById("setupMessage");

                const unlockSecret = unlockSecretInput.value;
                const confirmUnlockSecret = confirmInput.value;

                setupMessage.textContent = "";

                if (unlockSecret !== confirmUnlockSecret) {
                    setupMessage.textContent = "Vault unlock secrets do not match";
                    return;
                }

                setupButton.disabled = true;
                setupMessage.textContent = "Creating your vault...";

                try {
                    const { payload, vaultKey } = await VaultSetup.initialiseVault(unlockSecret);

                    await VaultSetup.saveVaultSettings(payload);

                    setupMessage.textContent = "Vault created successfully";

                    unlockSecretInput.value = "";
                    confirmInput.value = "";
                    window.location.replace("/vault");

                } catch (error) {
                    setupMessage.textContent = error.message || "Failed to create vault";
                } finally {
                    setupButton.disabled = false;
                }
            });
        });
    }

    // Browser
    if (typeof window !== "undefined") {
        window.VaultSetup = VaultSetup;
    }

    // Node.js testing
    if (typeof module !== "undefined" && module.exports) {
        module.exports = VaultSetup;
    }
})();