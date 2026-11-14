
"use strict";

importScripts(
    "/public/vendor/argon2.umd.min.js",
    "/public/js/crypto/crypto.js",
    "/public/js/crypto/key-derivation.js"
);

let vaultKey = null;
let operationGeneration = 0;
let vaultOwnerId = null;

const workerInstanceId = crypto.randomUUID();

function clearVault() {
    operationGeneration++;
    vaultKey = null;
    vaultOwnerId = null;
}

async function getAuthenticatedUserId() {
    let response;

    try {
        response = await fetch("/api/auth/session", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });
    } catch (error) {
        clearVault();
        throw new Error("Unable to verify session");
    }

    if (!response.ok) {
        clearVault();

        if (response.status === 401) {
            throw new Error("Session expired");
        }

        throw new Error("Session verification failed");
    }

    let data;

    try {
        data = await response.json();
    } catch (error) {
        clearVault();
        throw new Error("Invalid session response");
    }

    if (typeof data?.userId !== "string" || !data.userId) {
        clearVault();
        throw new Error("Invalid session identity");
    }

    return data.userId;
}

async function requireUnlockedVault() {
    const generation = operationGeneration;
    const ownerId = vaultOwnerId;
    const key = vaultKey;

    if (!key || !ownerId) {
        throw new Error("Vault is locked");
    }

    let currentUserId;

    try {
        currentUserId = await getAuthenticatedUserId();
    } catch (error) {
        if (generation === operationGeneration) {
            clearVault();
        }
        throw new Error("Authentication required");
    }

    if (generation !== operationGeneration) {
        throw new Error("Vault state changed");
    }

    if (currentUserId !== ownerId) {
        clearVault();
        throw new Error("Vault session mismatch");
    }

    return key;
}

self.onconnect = function (event) {
    const port = event.ports[0];

    port.onmessage = async function (event) {
        const { type, requestId } = event.data ?? {};

        switch (type) {
            case "STATUS": {
                const generation = operationGeneration;

                try {
                    const currentUserId = await getAuthenticatedUserId();

                    if (generation !== operationGeneration) {
                        port.postMessage({
                            type: "STATUS_RESULT",
                            requestId,
                            unlocked: false,
                            stale: true
                        });
                        break;
                    }

                    if (vaultOwnerId !== currentUserId) {
                        clearVault();
                    }

                    port.postMessage({
                        type: "STATUS_RESULT",
                        requestId,
                        workerInstanceId,
                        unlocked: vaultKey !== null
                    });

                } catch (error) {
                    if (generation !== operationGeneration) {
                        port.postMessage({
                            type: "STATUS_RESULT",
                            requestId,
                            unlocked: false,
                            stale: true
                        });
                        break;
                    }

                    clearVault();

                    port.postMessage({
                        type: "STATUS_RESULT",
                        requestId,
                        unlocked: false
                    });
                }

                break;
            }

            case "LOCK":
                clearVault();

                port.postMessage({
                    type: "LOCK_RESULT",
                    requestId,
                    workerInstanceId,
                    unlocked: false
                });
                break;

            case "UNLOCK": {
                clearVault();
                const generation = operationGeneration;

                try {
                    const { unlockSecret, settings } = event.data;

                    const userId = await getAuthenticatedUserId();

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
                        port.postMessage({
                            type: "UNLOCK_RESULT",
                            requestId,
                            success: false,
                            message: "Unlock operation cancelled"
                        });
                        break;
                    }

                    const currentUserId = await getAuthenticatedUserId();

                    if (generation !== operationGeneration || currentUserId !== userId) {
                        clearVault();

                        port.postMessage({
                            type: "UNLOCK_RESULT",
                            requestId,
                            success: false,
                            message: "Session changed during unlock"
                        });
                        break;
                    }


                    vaultKey = key;
                    vaultOwnerId = userId

                    port.postMessage({
                        type: "UNLOCK_RESULT",
                        requestId,
                        workerInstanceId,
                        success: true
                    });

                } catch (error) {
                    port.postMessage({
                        type: "UNLOCK_RESULT",
                        requestId,
                        success: false,
                        message: generation === operationGeneration
                            ? "Unable to unlock vault"
                            : "Unlock operation cancelled"
                    });
                }

                break;
            }

            case "ENCRYPT_ENTRY": {
                try {
                    const { entryId, payload, cryptoVersion = 1 } = event.data;

                    if (
                        typeof entryId !== "string" ||
                        !/^[a-fA-F0-9]{24}$/.test(entryId) ||
                        !payload ||
                        typeof payload !== "object" ||
                        Array.isArray(payload) ||
                        cryptoVersion !== 1
                    ) {
                        throw new Error("Invalid entry data");
                    }

                    const key = await requireUnlockedVault();
                    const generation = operationGeneration;

                    const { iv, ciphertext } = await VaultCrypto.encryptPayload(
                        payload,
                        key,
                        entryId,
                        cryptoVersion
                    );

                    if (generation !== operationGeneration) {
                        throw new Error("Vault state changed during encryption");
                    }

                    port.postMessage({
                        type: "ENCRYPT_ENTRY_RESULT",
                        requestId,
                        workerInstanceId,
                        success: true,
                        entry: {
                            entryId,
                            cryptoVersion,
                            iv: VaultCrypto.arrayBufferToBase64(iv),
                            ciphertext: VaultCrypto.arrayBufferToBase64(ciphertext)
                        }
                    });

                } catch (error) {
                    port.postMessage({
                        type: "ENCRYPT_ENTRY_RESULT",
                        requestId,
                        success: false,
                        message: "Unable to encrypt entry"
                    });
                }

                break;
            }

            case "DECRYPT_ENTRY": {
                try {
                    const { entry } = event.data ?? {};

                    if (
                        !entry ||
                        typeof entry.entryId !== "string" ||
                        !/^[a-fA-F0-9]{24}$/.test(entry.entryId) ||
                        entry.cryptoVersion !== 1 ||
                        typeof entry.iv !== "string" ||
                        typeof entry.ciphertext !== "string"
                    ) {
                        throw new Error("Invalid encrypted entry");
                    }

                    const key = await requireUnlockedVault();
                    const generation = operationGeneration;

                    const iv = VaultCrypto.base64ToArrayBuffer(entry.iv);
                    const ciphertext = VaultCrypto.base64ToArrayBuffer(entry.ciphertext);

                    if (iv.byteLength !== 12 || ciphertext.byteLength < 16) {
                        throw new Error("Invalid encryption data");
                    }

                    const payload = await VaultCrypto.decryptPayload(
                        ciphertext,
                        key,
                        iv,
                        entry.entryId,
                        entry.cryptoVersion
                    );

                    if (generation !== operationGeneration) {
                        throw new Error("Vault state changed during decryption");
                    }

                    port.postMessage({
                        type: "DECRYPT_ENTRY_RESULT",
                        requestId,
                        workerInstanceId,
                        success: true,
                        payload
                    });

                } catch (error) {
                    port.postMessage({
                        type: "DECRYPT_ENTRY_RESULT",
                        requestId,
                        success: false,
                        message: "Unable to decrypt entry"
                    });
                }

                break;
            }

            default:
                port.postMessage({
                    type: "ERROR",
                    requestId,
                    message: "Unknown worker command"
                });
        }
    };

    port.start();
};
