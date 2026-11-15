"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const workerSource = fs.readFileSync(
    path.join(
        __dirname,
        "../src/public/js/workers/vault-worker.js"
    ),
    "utf8"
);

function createMockPort() {
    const messages = [];

    const port = {
        onmessage: null,

        start() { },

        postMessage(message) {
            messages.push(message);
        }
    };

    return {
        port,
        messages,

        async send(message) {
            await port.onmessage({ data: message });
        }
    };
}

test("vault worker initialises in an isolated context", () => {
    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => { },

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    assert.equal(typeof context.self.onconnect, "function");
});

test("LOCK command returns a locked vault status", async () => {
    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => { },

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({
        ports: [port]
    });

    await send({
        type: "LOCK",
        requestId: "request-1"
    });

    assert.equal(messages.length, 1);

    assert.equal(messages[0].type, "LOCK_RESULT");
    assert.equal(messages[0].requestId, "request-1");
    assert.equal(messages[0].unlocked, false);
    assert.equal(messages[0].workerInstanceId, "test-worker-id");
});

test("STATUS reports locked for an authenticated user", async () => {
    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => { },

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        fetch: async () => ({
            ok: true,
            status: 200,

            json: async () => ({
                userId: "user-123"
            })
        }),

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({
        ports: [port]
    });

    await send({
        type: "STATUS",
        requestId: "request-2"
    });

    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, "STATUS_RESULT");
    assert.equal(messages[0].requestId, "request-2");
    assert.equal(messages[0].unlocked, false);
    assert.equal(messages[0].workerInstanceId, "test-worker-id");
});

test("UNLOCK, STATUS and LOCK manage the vault lifecycle", async () => {
    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => { },

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                userId: "user-123"
            })
        }),

        VaultCrypto: {
            base64ToArrayBuffer: () => new ArrayBuffer(16)
        },

        VaultKeyDerivation: {
            unlockVault: async () => ({
                id: "mock-vault-key"
            })
        },

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({
        ports: [port]
    });

    const settings = {
        cryptoVersion: 1,
        salt: "mock-salt",
        wrapIv: "mock-iv",
        wrappedVaultKey: "mock-key",

        kdf: {
            algorithm: "argon2id",
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32
        }
    };

    // Unlock
    await send({
        type: "UNLOCK",
        requestId: "unlock-1",
        unlockSecret: "test-secret",
        settings
    });

    assert.equal(messages.at(-1).type, "UNLOCK_RESULT");
    assert.equal(messages.at(-1).success, true);

    // Check status
    await send({
        type: "STATUS",
        requestId: "status-1"
    });

    assert.equal(messages.at(-1).type, "STATUS_RESULT");
    assert.equal(messages.at(-1).unlocked, true);

    // Lock
    await send({
        type: "LOCK",
        requestId: "lock-1"
    });

    assert.equal(messages.at(-1).type, "LOCK_RESULT");
    assert.equal(messages.at(-1).unlocked, false);

    // Check status again
    await send({
        type: "STATUS",
        requestId: "status-2"
    });

    assert.equal(messages.at(-1).type, "STATUS_RESULT");
    assert.equal(messages.at(-1).unlocked, false);
});

test("LOCK cancels an in-progress UNLOCK operation", async () => {
    let finishUnlock;

    const unlockPromise = new Promise((resolve) => {
        finishUnlock = resolve;
    });

    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => { },

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                userId: "user-123"
            })
        }),

        VaultCrypto: {
            base64ToArrayBuffer: () => new ArrayBuffer(16)
        },

        VaultKeyDerivation: {
            unlockVault: () => unlockPromise
        },

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({
        ports: [port]
    });

    const settings = {
        cryptoVersion: 1,
        salt: "mock-salt",
        wrapIv: "mock-iv",
        wrappedVaultKey: "mock-key",

        kdf: {
            algorithm: "argon2id",
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32
        }
    };

    // Start unlocking without awaiting completion
    const pendingUnlock = send({
        type: "UNLOCK",
        requestId: "unlock-1",
        unlockSecret: "test-secret",
        settings
    });

    // Allow the initial authentication request to finish
    await new Promise((resolve) => setImmediate(resolve));

    // Lock while key derivation is still pending
    await send({
        type: "LOCK",
        requestId: "lock-1"
    });

    assert.equal(
        messages.at(-1).type,
        "LOCK_RESULT"
    );

    // Complete the original key derivation
    finishUnlock({ id: "old-key" });

    await pendingUnlock;

    const unlockResult = messages.find(
        (message) => message.requestId === "unlock-1"
    );

    assert.equal(unlockResult.success, false);
    assert.equal(
        unlockResult.message,
        "Unlock operation cancelled"
    );

    // Verify the vault is still locked
    await send({
        type: "STATUS",
        requestId: "status-1"
    });

    assert.equal(messages.at(-1).unlocked, false);
});

test("older UNLOCK cannot overwrite a newer successful UNLOCK", async () => {
    const pendingUnlocks = [];

    let encryptionKeyUsed = null;

    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => { },

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                userId: "user-123"
            })
        }),

        VaultCrypto: {
            base64ToArrayBuffer: () => new ArrayBuffer(16),

            encryptPayload: async (payload, key) => {
                encryptionKeyUsed = key;

                return {
                    iv: new ArrayBuffer(12),
                    ciphertext: new ArrayBuffer(32)
                };
            },

            arrayBufferToBase64: () => "mock-base64"
        },

        VaultKeyDerivation: {
            unlockVault: () => new Promise((resolve) => {
                pendingUnlocks.push(resolve);
            })
        },

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({ ports: [port] });

    const settings = {
        cryptoVersion: 1,
        salt: "mock-salt",
        wrapIv: "mock-iv",
        wrappedVaultKey: "mock-key",

        kdf: {
            algorithm: "argon2id",
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32
        }
    };

    // Start the first unlock
    const firstUnlock = send({
        type: "UNLOCK",
        requestId: "unlock-1",
        unlockSecret: "first-secret",
        settings
    });

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(pendingUnlocks.length, 1);

    // Start a second unlock
    const secondUnlock = send({
        type: "UNLOCK",
        requestId: "unlock-2",
        unlockSecret: "second-secret",
        settings
    });

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(pendingUnlocks.length, 2);

    // Complete the second unlock first
    pendingUnlocks[1]({ id: "new-key" });

    await secondUnlock;

    const secondResult = messages.find(
        (message) => message.requestId === "unlock-2"
    );

    assert.equal(secondResult.success, true);

    // Now complete the older unlock
    pendingUnlocks[0]({ id: "old-key" });

    await firstUnlock;

    const firstResult = messages.find(
        (message) => message.requestId === "unlock-1"
    );

    assert.equal(firstResult.success, false);
    assert.equal(firstResult.message, "Unlock operation cancelled");

    // Verify the newer unlock remains active
    await send({
        type: "STATUS",
        requestId: "status-1"
    });

    assert.equal(messages.at(-1).unlocked, true);

    await send({
        type: "ENCRYPT_ENTRY",
        requestId: "encrypt-1",
        entryId: "507f1f77bcf86cd799439011",
        payload: {
            type: "note",
            title: "Test note",
            content: "Hello"
        },
        cryptoVersion: 1
    });

    const encryptionResult = messages.find(
        (message) => message.requestId === "encrypt-1"
    );

    assert.equal(encryptionResult.success, true);

    assert.equal(encryptionKeyUsed.id, "new-key");
});

test("LOCK invalidates an in-progress encryption", async () => {
    let finishEncryption;
    let encryptionStarted;

    const started = new Promise((resolve) => {
        encryptionStarted = resolve;
    });

    const encryptionPromise = new Promise((resolve) => {
        finishEncryption = resolve;
    });

    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => { },

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({ userId: "user-123" })
        }),

        VaultCrypto: {
            base64ToArrayBuffer: () => new ArrayBuffer(16),

            encryptPayload: () => {
                encryptionStarted();
                return encryptionPromise;
            },

            arrayBufferToBase64: () => "mock-base64"
        },

        VaultKeyDerivation: {
            unlockVault: async () => ({ id: "test-key" })
        },

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({ ports: [port] });

    const settings = {
        cryptoVersion: 1,
        salt: "mock-salt",
        wrapIv: "mock-iv",
        wrappedVaultKey: "mock-key",
        kdf: {
            algorithm: "argon2id",
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32
        }
    };

    // Unlock successfully
    await send({
        type: "UNLOCK",
        requestId: "unlock-1",
        unlockSecret: "test-secret",
        settings
    });

    assert.equal(messages.at(-1).success, true);

    // Begin encryption without waiting for it to finish
    const pendingEncryption = send({
        type: "ENCRYPT_ENTRY",
        requestId: "encrypt-1",
        entryId: "507f1f77bcf86cd799439011",
        payload: {
            type: "note",
            title: "Test",
            content: "Hello"
        },
        cryptoVersion: 1
    });

    // Wait until encryption has actually started
    await started;

    // Lock the vault while encryption is pending
    await send({
        type: "LOCK",
        requestId: "lock-1"
    });

    // Allow encryption to complete
    finishEncryption({
        iv: new ArrayBuffer(12),
        ciphertext: new ArrayBuffer(32)
    });

    await pendingEncryption;

    const result = messages.find(
        (message) => message.requestId === "encrypt-1"
    );

    assert.equal(result.success, false);
    assert.equal(result.message, "Unable to encrypt entry");

    // Confirm the vault remains locked
    await send({
        type: "STATUS",
        requestId: "status-1"
    });

    assert.equal(messages.at(-1).unlocked, false);
});

test("LOCK prevents an in-progress decryption from returning plaintext", async () => {
    let finishDecryption;
    let decryptionStarted;

    const started = new Promise((resolve) => {
        decryptionStarted = resolve;
    });

    const decryptionPromise = new Promise((resolve) => {
        finishDecryption = resolve;
    });

    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => { },

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                userId: "user-123"
            })
        }),

        VaultCrypto: {
            base64ToArrayBuffer: (value) => {
                if (value === "mock-iv") {
                    return new ArrayBuffer(12);
                }

                return new ArrayBuffer(32);
            },

            decryptPayload: () => {
                decryptionStarted();
                return decryptionPromise;
            }
        },

        VaultKeyDerivation: {
            unlockVault: async () => ({
                id: "test-key"
            })
        },

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({ ports: [port] });

    const settings = {
        cryptoVersion: 1,
        salt: "mock-salt",
        wrapIv: "mock-iv",
        wrappedVaultKey: "mock-key",

        kdf: {
            algorithm: "argon2id",
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32
        }
    };

    // Unlock the vault
    await send({
        type: "UNLOCK",
        requestId: "unlock-1",
        unlockSecret: "test-secret",
        settings
    });

    assert.equal(messages.at(-1).success, true);

    // Begin decryption
    const pendingDecryption = send({
        type: "DECRYPT_ENTRY",
        requestId: "decrypt-1",
        entry: {
            entryId: "507f1f77bcf86cd799439011",
            cryptoVersion: 1,
            iv: "mock-iv",
            ciphertext: "mock-ciphertext"
        }
    });

    // Wait until decryption has started
    await started;

    // Lock while decryption is pending
    await send({
        type: "LOCK",
        requestId: "lock-1"
    });

    // Finish the old decryption operation
    finishDecryption({
        type: "note",
        title: "Private note",
        content: "Sensitive plaintext"
    });

    await pendingDecryption;

    const result = messages.find(
        (message) => message.requestId === "decrypt-1"
    );

    assert.equal(result.success, false);
    assert.equal(result.message, "Unable to decrypt entry");

    // Plaintext must not appear in the response
    assert.equal(result.payload, undefined);

    // Vault must remain locked
    await send({
        type: "STATUS",
        requestId: "status-1"
    });

    assert.equal(messages.at(-1).unlocked, false);
});

test("expired session locks an unlocked vault", async () => {
    let sessionExpired = false;

    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => {},

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        fetch: async () => {
            if (sessionExpired) {
                return {
                    ok: false,
                    status: 401
                };
            }

            return {
                ok: true,
                status: 200,
                json: async () => ({
                    userId: "user-123"
                })
            };
        },

        VaultCrypto: {
            base64ToArrayBuffer: () => new ArrayBuffer(16)
        },

        VaultKeyDerivation: {
            unlockVault: async () => ({
                id: "test-key"
            })
        },

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({ ports: [port] });

    const settings = {
        cryptoVersion: 1,
        salt: "mock-salt",
        wrapIv: "mock-iv",
        wrappedVaultKey: "mock-key",

        kdf: {
            algorithm: "argon2id",
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32
        }
    };

    // Start with a valid session
    await send({
        type: "UNLOCK",
        requestId: "unlock-1",
        unlockSecret: "test-secret",
        settings
    });

    assert.equal(messages.at(-1).success, true);

    // Simulate session expiry
    sessionExpired = true;

    await send({
        type: "STATUS",
        requestId: "status-expired"
    });

    const expiredStatus = messages.find(
        (message) => message.requestId === "status-expired"
    );

    assert.equal(expiredStatus.unlocked, false);

    // Restore authentication without unlocking again
    sessionExpired = false;

    await send({
        type: "STATUS",
        requestId: "status-restored"
    });

    const restoredStatus = messages.find(
        (message) => message.requestId === "status-restored"
    );

    assert.equal(restoredStatus.unlocked, false);
});

test("stale authentication failure cannot lock a newer vault", async () => {
    let finishOldAuth;
    let oldAuthStarted;

    const started = new Promise((resolve) => {
        oldAuthStarted = resolve;
    });

    const oldAuthResponse = new Promise((resolve) => {
        finishOldAuth = resolve;
    });

    let delayNextAuth = false;

    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => {},

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        fetch: async () => {
            if (delayNextAuth) {
                delayNextAuth = false;
                oldAuthStarted();
                return oldAuthResponse;
            }

            return {
                ok: true,
                status: 200,
                json: async () => ({
                    userId: "user-123"
                })
            };
        },

        VaultCrypto: {
            base64ToArrayBuffer: () => new ArrayBuffer(16)
        },

        VaultKeyDerivation: {
            unlockVault: async (secret) => ({
                id: secret
            })
        },

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({ ports: [port] });

    const settings = {
        cryptoVersion: 1,
        salt: "mock-salt",
        wrapIv: "mock-iv",
        wrappedVaultKey: "mock-key",

        kdf: {
            algorithm: "argon2id",
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32
        }
    };

    // Establish the original unlocked state
    await send({
        type: "UNLOCK",
        requestId: "unlock-1",
        unlockSecret: "old-key",
        settings
    });

    assert.equal(messages.at(-1).success, true);

    // Delay the next authentication request
    delayNextAuth = true;

    const pendingStatus = send({
        type: "STATUS",
        requestId: "status-old"
    });

    await started;

    // Start and complete a newer unlock
    await send({
        type: "UNLOCK",
        requestId: "unlock-2",
        unlockSecret: "new-key",
        settings
    });

    assert.equal(messages.at(-1).success, true);

    // The old authentication request now fails
    finishOldAuth({
        ok: false,
        status: 401
    });

    await pendingStatus;

    const oldStatus = messages.find(
        (message) => message.requestId === "status-old"
    );

    assert.equal(oldStatus.unlocked, false);
    assert.equal(oldStatus.stale, true);

    // The newer vault must remain unlocked
    await send({
        type: "STATUS",
        requestId: "status-new"
    });

    assert.equal(messages.at(-1).unlocked, true);
});

test("stale encryption authentication failure cannot lock a newer vault", async () => {
    let finishOldAuth;
    let oldAuthStarted;

    const started = new Promise((resolve) => {
        oldAuthStarted = resolve;
    });

    const oldAuthResponse = new Promise((resolve) => {
        finishOldAuth = resolve;
    });

    let delayNextAuth = false;
    let encryptionKeyUsed = null;

    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => {},

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        fetch: async () => {
            if (delayNextAuth) {
                delayNextAuth = false;
                oldAuthStarted();
                return oldAuthResponse;
            }

            return {
                ok: true,
                status: 200,
                json: async () => ({
                    userId: "user-123"
                })
            };
        },

        VaultCrypto: {
            base64ToArrayBuffer: () => new ArrayBuffer(16),

            encryptPayload: async (payload, key) => {
                encryptionKeyUsed = key;

                return {
                    iv: new ArrayBuffer(12),
                    ciphertext: new ArrayBuffer(32)
                };
            },

            arrayBufferToBase64: () => "mock-base64"
        },

        VaultKeyDerivation: {
            unlockVault: async (secret) => ({
                id: secret
            })
        },

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({ ports: [port] });

    const settings = {
        cryptoVersion: 1,
        salt: "mock-salt",
        wrapIv: "mock-iv",
        wrappedVaultKey: "mock-key",

        kdf: {
            algorithm: "argon2id",
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32
        }
    };

    const entry = {
        type: "ENCRYPT_ENTRY",
        entryId: "507f1f77bcf86cd799439011",
        payload: {
            type: "note",
            title: "Test",
            content: "Hello"
        },
        cryptoVersion: 1
    };

    // Unlock using the original key
    await send({
        type: "UNLOCK",
        requestId: "unlock-1",
        unlockSecret: "old-key",
        settings
    });

    assert.equal(messages.at(-1).success, true);

    // Delay authentication for the next encryption
    delayNextAuth = true;

    const pendingEncryption = send({
        ...entry,
        requestId: "encrypt-old"
    });

    await started;

    // Establish a newer unlocked session
    await send({
        type: "UNLOCK",
        requestId: "unlock-2",
        unlockSecret: "new-key",
        settings
    });

    assert.equal(messages.at(-1).success, true);

    // Old authentication fails after the new unlock
    finishOldAuth({
        ok: false,
        status: 401
    });

    await pendingEncryption;

    const oldResult = messages.find(
        (message) => message.requestId === "encrypt-old"
    );

    assert.equal(oldResult.success, false);
    assert.equal(oldResult.entry, undefined);

    // The old encryption must never reach encryptPayload
    assert.equal(encryptionKeyUsed, null);

    // Verify that the new vault is still unlocked
    await send({
        type: "STATUS",
        requestId: "status-new"
    });

    assert.equal(messages.at(-1).unlocked, true);

    // Verify that encryption works using the newer key
    await send({
        ...entry,
        requestId: "encrypt-new"
    });

    const newResult = messages.find(
        (message) => message.requestId === "encrypt-new"
    );

    assert.equal(newResult.success, true);
    assert.equal(encryptionKeyUsed.id, "new-key");
});

test("vault locks when authenticated user changes", async () => {
    let currentUserId = "user-123";

    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => {},

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                userId: currentUserId
            })
        }),

        VaultCrypto: {
            base64ToArrayBuffer: () => new ArrayBuffer(16)
        },

        VaultKeyDerivation: {
            unlockVault: async () => ({
                id: "user-123-key"
            })
        },

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({ ports: [port] });

    const settings = {
        cryptoVersion: 1,
        salt: "mock-salt",
        wrapIv: "mock-iv",
        wrappedVaultKey: "mock-key",
        kdf: {
            algorithm: "argon2id",
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32
        }
    };

    // Unlock as User A
    await send({
        type: "UNLOCK",
        requestId: "unlock-a",
        unlockSecret: "test-secret",
        settings
    });

    assert.equal(messages.at(-1).success, true);

    // Simulate switching accounts
    currentUserId = "user-456";

    await send({
        type: "STATUS",
        requestId: "status-b"
    });

    assert.equal(messages.at(-1).unlocked, false);

    // Switch back to User A
    currentUserId = "user-123";

    await send({
        type: "STATUS",
        requestId: "status-a"
    });

    // The original key must not be restored
    assert.equal(messages.at(-1).unlocked, false);
});

test("ENCRYPT_ENTRY rejects a different authenticated user", async () => {
    let currentUserId = "user-123";
    let encryptionCalled = false;

    const context = {
        crypto: {
            randomUUID: () => "test-worker-id"
        },

        importScripts: () => {},

        createVaultState: require(
            "../src/public/js/workers/vault-state"
        ),

        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                userId: currentUserId
            })
        }),

        VaultCrypto: {
            base64ToArrayBuffer: () => new ArrayBuffer(16),

            encryptPayload: async () => {
                encryptionCalled = true;

                return {
                    iv: new ArrayBuffer(12),
                    ciphertext: new ArrayBuffer(32)
                };
            },

            arrayBufferToBase64: () => "mock-base64"
        },

        VaultKeyDerivation: {
            unlockVault: async () => ({
                id: "user-123-key"
            })
        },

        self: {}
    };

    vm.runInNewContext(workerSource, context);

    const { port, messages, send } = createMockPort();

    context.self.onconnect({ ports: [port] });

    const settings = {
        cryptoVersion: 1,
        salt: "mock-salt",
        wrapIv: "mock-iv",
        wrappedVaultKey: "mock-key",

        kdf: {
            algorithm: "argon2id",
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32
        }
    };

    // Unlock as User A
    await send({
        type: "UNLOCK",
        requestId: "unlock-a",
        unlockSecret: "test-secret",
        settings
    });

    assert.equal(messages.at(-1).success, true);

    // Server session now belongs to User B
    currentUserId = "user-456";

    await send({
        type: "ENCRYPT_ENTRY",
        requestId: "encrypt-b",
        entryId: "507f1f77bcf86cd799439011",
        payload: {
            type: "note",
            title: "Private note",
            content: "User A's data"
        },
        cryptoVersion: 1
    });

    const result = messages.find(
        (message) => message.requestId === "encrypt-b"
    );

    assert.equal(result.success, false);
    assert.equal(result.entry, undefined);

    // Encryption must never have started
    assert.equal(encryptionCalled, false);

    // Switching back must not restore User A's key
    currentUserId = "user-123";

    await send({
        type: "STATUS",
        requestId: "status-a"
    });

    assert.equal(messages.at(-1).unlocked, false);
});