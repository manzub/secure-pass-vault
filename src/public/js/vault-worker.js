
"use strict";

importScripts(
    "/public/vendor/argon2.umd.min.js",
    "/public/js/crypto.js",
    "/public/js/key-derivation.js"
);

let vaultKey = null;
let operationGeneration = 0;

self.onconnect = function (event) {
    const port = event.ports[0];

    port.onmessage = async function (event) {
        const { type } = event.data ?? {};

        switch (type) {
            case "STATUS":
                port.postMessage({
                    type: "STATUS_RESULT",
                    unlocked: vaultKey !== null
                });
                break;

            case "LOCK":
                operationGeneration++;
                vaultKey = null;

                port.postMessage({
                    type: "LOCK_RESULT",
                    unlocked: false
                });
                break;

            case "UNLOCK": {
                const generation = ++operationGeneration;
                vaultKey = null

                try {
                    const { unlockSecret, settings } = event.data;

                    if (typeof unlockSecret !== "string" || !settings) {
                        throw new Error("Invalid unlock request");
                    }

                    if (
                        settings.cryptoVersion !== 1 ||
                        settings.kdf?.algorithm !== "argon2id" ||
                        settings.kdf.iterations !== 3 ||
                        settings.kdf.parallelism !== 1 ||
                        settings.kdf.memorySize !== 65536 ||
                        settings.kdf.hashLength !== 32
                    ) {
                        throw new Error("Unsupported vault configuration");
                    }

                    const metadata = {
                        salt: VaultCrypto.base64ToArrayBuffer(settings.salt),
                        iv: VaultCrypto.base64ToArrayBuffer(settings.wrapIv),
                        wrappedKey: VaultCrypto.base64ToArrayBuffer(settings.wrappedVaultKey)
                    };

                    const key = await VaultKeyDerivation.unlockVault(
                        unlockSecret,
                        metadata
                    );

                    if (generation !== operationGeneration) {
                        break;
                    }

                    vaultKey = key;

                    port.postMessage({
                        type: "UNLOCK_RESULT",
                        success: true
                    });

                } catch (error) {
                    if (generation === operationGeneration) {
                        port.postMessage({
                            type: "UNLOCK_RESULT",
                            success: false,
                            message: "Unable to unlock vault"
                        });
                    }
                }

                break;
        }

            default:
        port.postMessage({
            type: "ERROR",
            message: "Unknown worker command"
        });
    }
};

port.start();
};
