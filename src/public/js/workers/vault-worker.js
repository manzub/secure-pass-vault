
"use strict";

importScripts(
    "/public/vendor/argon2.umd.min.js",
    "/public/js/crypto/crypto.js",
    "/public/js/crypto/key-derivation.js",
    "/public/js/workers/vault-state.js"
);

const vaultState = createVaultState();

const workerInstanceId = crypto.randomUUID();
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

let lastActivity = 0;
let inactivityTimer = null;

const connectedPorts = new Set();

function notifyVaultLocked() {
    for (const port of connectedPorts) {
        try {
            port.postMessage({
                type: "VAULT_AUTO_LOCKED",
                workerInstanceId
            });
        } catch (error) {
            connectedPorts.delete(port);
        }
    }
}

function clearInactivityTimer() {
    if (inactivityTimer !== null) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
}

function recordActivity() {
    if (!vaultState.isUnlocked()) return;

    lastActivity = Date.now();

    clearInactivityTimer();

    inactivityTimer = setTimeout(() => {
        inactivityTimer = null;
        enforceInactivityTimeout();
    }, INACTIVITY_TIMEOUT);
}

function enforceInactivityTimeout() {
    if (!vaultState.isUnlocked()) return false;

    if (Date.now() - lastActivity >= INACTIVITY_TIMEOUT) {
        clearVault();
        notifyVaultLocked();
        return true;
    }

    return false;
}

function clearVault() {
    clearInactivityTimer();
    vaultState.lock();
    lastActivity = 0
}

async function getAuthenticatedUserId() {

    const generation = vaultState.getGeneration();

    function clearIfCurrent() {
        vaultState.lockIfCurrent(generation);
    }


    let response;

    try {
        response = await fetch("/api/auth/session", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });
    } catch (error) {
        clearIfCurrent();
        throw new Error("Unable to verify session");
    }

    if (!response.ok) {
        clearIfCurrent();

        if (response.status === 401) {
            throw new Error("Session expired");
        }

        throw new Error("Session verification failed");
    }

    let data;

    try {
        data = await response.json();
    } catch (error) {
        clearIfCurrent();
        throw new Error("Invalid session response");
    }

    if (typeof data?.userId !== "string" || !data.userId) {
        clearIfCurrent();
        throw new Error("Invalid session identity");
    }

    return data.userId;
}

async function requireUnlockedVault() {
    enforceInactivityTimeout()

    const generation = vaultState.getGeneration();
    const ownerId = vaultState.getOwnerId();
    const key = vaultState.getKey();

    if (!key || !ownerId) {
        throw new Error("Vault is locked");
    }

    let currentUserId;

    try {
        currentUserId = await getAuthenticatedUserId();
    } catch (error) {
        vaultState.lockIfCurrent(generation);

        throw new Error("Authentication required");
    }

    enforceInactivityTimeout();

    if (!vaultState.isCurrent(generation)) {
        throw new Error("Vault state changed");
    }

    if (currentUserId !== ownerId) {
        vaultState.lockIfCurrent(generation);
        throw new Error("Vault session mismatch");
    }

    return { key, generation };
}

self.onconnect = function (event) {
    const port = event.ports[0];

    connectedPorts.add(port);

    port.onmessage = async function (event) {
        const { type, requestId } = event.data ?? {};

        switch (type) {
            case "STATUS": {
                const generation = vaultState.getGeneration();

                try {
                    const currentUserId = await getAuthenticatedUserId();

                    if (!vaultState.isCurrent(generation)) {
                        port.postMessage({
                            type: "STATUS_RESULT",
                            requestId,
                            unlocked: false,
                            stale: true
                        });
                        break;
                    }

                    if (vaultState.getOwnerId() !== currentUserId) {
                        vaultState.lockIfCurrent(generation);
                    }

                    port.postMessage({
                        type: "STATUS_RESULT",
                        requestId,
                        workerInstanceId,
                        unlocked: vaultState.isUnlocked()
                    });

                } catch (error) {
                    if (!vaultState.isCurrent(generation)) {
                        port.postMessage({
                            type: "STATUS_RESULT",
                            requestId,
                            unlocked: false,
                            stale: true
                        });
                        break;
                    }

                    vaultState.lockIfCurrent(generation);

                    port.postMessage({
                        type: "STATUS_RESULT",
                        requestId,
                        unlocked: false
                    });
                }

                break;
            }

            case "ACTIVITY": {
                const expired = enforceInactivityTimeout();

                if (!expired && vaultState.isUnlocked()) {
                    recordActivity();
                }

                port.postMessage({
                    type: "ACTIVITY_RESULT",
                    requestId,
                    workerInstanceId,
                    unlocked: vaultState.isUnlocked()
                });

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
                const generation = vaultState.getGeneration();

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

                    if (!vaultState.isCurrent(generation)) {
                        port.postMessage({
                            type: "UNLOCK_RESULT",
                            requestId,
                            success: false,
                            message: "Unlock operation cancelled"
                        });
                        break;
                    }

                    const currentUserId = await getAuthenticatedUserId();

                    if (!vaultState.isCurrent(generation)) {
                        port.postMessage({
                            type: "UNLOCK_RESULT",
                            requestId,
                            success: false,
                            message: "Unlock operation cancelled"
                        });
                        break;
                    }

                    if (currentUserId !== userId) {
                        vaultState.lockIfCurrent(generation);

                        port.postMessage({
                            type: "UNLOCK_RESULT",
                            requestId,
                            success: false,
                            message: "Session changed during unlock"
                        });
                        break;
                    }

                    vaultState.unlock(key, userId, generation);
                    recordActivity()

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
                        message: vaultState.isCurrent(generation)
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

                    const { key, generation } = await requireUnlockedVault();

                    const { iv, ciphertext } = await VaultCrypto.encryptPayload(
                        payload,
                        key,
                        entryId,
                        cryptoVersion
                    );

                    enforceInactivityTimeout();

                    if (!vaultState.isCurrent(generation)) {
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

                    const { key, generation } = await requireUnlockedVault();

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

                    enforceInactivityTimeout();

                    if (!vaultState.isCurrent(generation)) {
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
