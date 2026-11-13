(function () {
    "use strict";

    const isNode =
        typeof module !== "undefined" &&
        typeof module.exports !== "undefined";

    const hashwasm = isNode
        ? require("hash-wasm")
        : globalThis.hashwasm;

    const VaultCrypto = isNode
        ? require("./crypto")
        : globalThis.VaultCrypto;

    async function deriveVaultKeyEncryptionKey(unlockSecret, salt) {
        const derivedKey = await hashwasm.argon2id({
            password: unlockSecret,
            salt: new Uint8Array(salt),
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32,
            outputType: "binary"
        });

        return derivedKey;
    }

    async function importVaultKeyEncryptionKey(derivedKey) {
        return crypto.subtle.importKey(
            "raw",
            derivedKey,
            {
                name: "AES-GCM",
                length: 256
            },
            false,
            ["encrypt", "decrypt"]
        );
    }

    async function wrapVaultEncryptionKey(vaultEncryptionKey, kek) {
        const rawVaultKey = await crypto.subtle.exportKey(
            "raw",
            vaultEncryptionKey
        );

        try {
            const iv = crypto.getRandomValues(new Uint8Array(12));

            const wrappedKey = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                kek,
                rawVaultKey
            );

            return { iv, wrappedKey };
        } finally {
            new Uint8Array(rawVaultKey).fill(0);
        }
    }

    async function unwrapVaultEncryptionKey(wrappedKey, kek, iv) {
        const rawVaultKey = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv
            },
            kek,
            wrappedKey
        );

        return crypto.subtle.importKey(
            "raw",
            rawVaultKey,
            {
                name: "AES-GCM",
                length: 256
            },
            false,
            ["encrypt", "decrypt"]
        );
    }

    async function setupVault(unlockSecret) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const derivedBytes = await deriveVaultKeyEncryptionKey(
            unlockSecret,
            salt
        );

        let kek;

        try {
            kek = await importVaultKeyEncryptionKey(derivedBytes);
        } finally {
            new Uint8Array(derivedBytes).fill(0); // delete from memory
        }

        const originalVaultKey = await VaultCrypto.generateEncryptionKey();
        const { iv, wrappedKey } = await wrapVaultEncryptionKey(
            originalVaultKey,
            kek
        );

        const vaultKey = await unwrapVaultEncryptionKey(
            wrappedKey,
            kek,
            iv
        );

        return {
            vaultKey,
            salt,
            iv,
            wrappedKey,
            kdf: {
                algorithm: "argon2id",
                iterations: 3,
                parallelism: 1,
                memorySize: 65536,
                hashLength: 32
            }
        };
    }

    async function unlockVault(unlockSecret, vaultMetadata) {
        const derivedBytes = await deriveVaultKeyEncryptionKey(
            unlockSecret,
            vaultMetadata.salt
        );

        let kek;

        try {
            kek = await importVaultKeyEncryptionKey(derivedBytes);
        } finally {
            new Uint8Array(derivedBytes).fill(0);
        }

        return unwrapVaultEncryptionKey(
            vaultMetadata.wrappedKey,
            kek,
            vaultMetadata.iv
        );
    }

    const VaultKeyDerivation = {
        deriveVaultKeyEncryptionKey,
        importVaultKeyEncryptionKey,
        wrapVaultEncryptionKey,
        unwrapVaultEncryptionKey,
        setupVault,
        unlockVault
    };

    if (typeof globalThis !== "undefined") {
        globalThis.VaultKeyDerivation = VaultKeyDerivation;
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = VaultKeyDerivation;
    }
})();