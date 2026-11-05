const test = require("node:test");
const assert = require("node:assert/strict");


const VaultKeyDerivation = require("../src/public/js/key-derivation");
const VaultCrypto = require("../src/public/js/crypto");

test("derive a 256-bit vault key encryption key", async () => {
    const unlockSecret = "my-test-vault-secret";
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const derivedKey = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey(unlockSecret, salt);

    assert.equal(derivedKey.byteLength, 32);
});

test("same secret and salt produce the same derived key", async () => {
    const unlockSecret = "my-test-vault-secret";
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const firstKey = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey(unlockSecret, salt);

    const secondKey = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey(unlockSecret, salt);

    assert.deepEqual(firstKey, secondKey);
});

test("different salts produce different derived keys", async () => {
    const unlockSecret = "my-test-vault-secret";

    const saltOne = crypto.getRandomValues(new Uint8Array(16));
    const saltTwo = crypto.getRandomValues(new Uint8Array(16));

    const firstKey = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey(unlockSecret, saltOne);

    const secondKey = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey(unlockSecret, saltTwo);

    assert.notDeepEqual(firstKey, secondKey);
});

test("import derived bytes as a non-extractable AES-GCM key", async () => {
    const unlockSecret = "my-test-vault-secret";
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const derivedBytes = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey(unlockSecret, salt);

    const kek = await VaultKeyDerivation
        .importVaultKeyEncryptionKey(derivedBytes);

    assert.equal(kek.type, "secret");
    assert.equal(kek.algorithm.name, "AES-GCM");
    assert.equal(kek.algorithm.length, 256);
    assert.equal(kek.extractable, false);
    assert.deepEqual(kek.usages, ["encrypt", "decrypt"]);
});

test("imported key can encrypt and decrypt data", async () => {
    const unlockSecret = "my-test-vault-secret";
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const derivedBytes = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey(unlockSecret, salt);

    const kek = await VaultKeyDerivation
        .importVaultKeyEncryptionKey(derivedBytes);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const originalData = new TextEncoder().encode("vault-key-test");

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        kek,
        originalData
    );

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        kek,
        encrypted
    );

    assert.deepEqual(
        new Uint8Array(decrypted),
        originalData
    );
});

test("wrap vault encryption key using KEK", async () => {
    const unlockSecret = "my-test-vault-secret";
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const derivedBytes = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey(unlockSecret, salt);

    const kek = await VaultKeyDerivation
        .importVaultKeyEncryptionKey(derivedBytes);

    const vaultKey = await VaultCrypto.generateEncryptionKey();

    const result = await VaultKeyDerivation
        .wrapVaultEncryptionKey(vaultKey, kek);

    assert.equal(result.iv.byteLength, 12);
    assert.ok(result.wrappedKey.byteLength > 0);
});

test("generate a unique IV for each wrapping operation", async () => {
    const unlockSecret = "my-test-vault-secret";
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const derivedBytes = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey(unlockSecret, salt);

    const kek = await VaultKeyDerivation
        .importVaultKeyEncryptionKey(derivedBytes);

    const vaultKey = await VaultCrypto.generateEncryptionKey();

    const first = await VaultKeyDerivation
        .wrapVaultEncryptionKey(vaultKey, kek);

    const second = await VaultKeyDerivation
        .wrapVaultEncryptionKey(vaultKey, kek);

    assert.notDeepEqual(first.iv, second.iv);
});

test("unwrap vault encryption key successfully", async () => {
    const unlockSecret = "my-test-vault-secret";
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive KEK
    const derivedBytes = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey(unlockSecret, salt);

    const kek = await VaultKeyDerivation
        .importVaultKeyEncryptionKey(derivedBytes);

    // Generate original vault key
    const originalVaultKey = await VaultCrypto.generateEncryptionKey();

    // Wrap vault key
    const { iv, wrappedKey } = await VaultKeyDerivation
        .wrapVaultEncryptionKey(originalVaultKey, kek);

    // Recover vault key
    const recoveredVaultKey = await VaultKeyDerivation
        .unwrapVaultEncryptionKey(wrappedKey, kek, iv);

    assert.equal(recoveredVaultKey.algorithm.name, "AES-GCM");
    assert.equal(recoveredVaultKey.algorithm.length, 256);
    assert.equal(recoveredVaultKey.extractable, false);

    const testIV = crypto.getRandomValues(new Uint8Array(12));
    const testData = new TextEncoder().encode("vault recovery test");

    const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: testIV },
        originalVaultKey,
        testData
    );

    const decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: testIV },
        recoveredVaultKey,
        encryptedData
    );

    assert.deepEqual(
        new Uint8Array(decryptedData),
        testData
    );
});

test("incorrect unlock secret cannot unwrap vault encryption key", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const correctBytes = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey("correct-secret", salt);

    const correctKEK = await VaultKeyDerivation
        .importVaultKeyEncryptionKey(correctBytes);

    const wrongBytes = await VaultKeyDerivation
        .deriveVaultKeyEncryptionKey("wrong-secret", salt);

    const wrongKEK = await VaultKeyDerivation
        .importVaultKeyEncryptionKey(wrongBytes);

    const vaultKey = await VaultCrypto.generateEncryptionKey();

    const { iv, wrappedKey } = await VaultKeyDerivation
        .wrapVaultEncryptionKey(vaultKey, correctKEK);

    await assert.rejects(
        VaultKeyDerivation.unwrapVaultEncryptionKey(
            wrappedKey,
            wrongKEK,
            iv
        )
    );
});

test("setup a new vault", async () => {
    const result = await VaultKeyDerivation.setupVault(
        "my-test-vault-secret"
    );

    assert.ok(result.vaultKey);
    assert.equal(result.vaultKey.extractable, false);

    assert.equal(result.salt.byteLength, 16);
    assert.equal(result.iv.byteLength, 12);
    assert.ok(result.wrappedKey.byteLength > 0);

    assert.equal(result.kdf.algorithm, "argon2id");

    const entryId = VaultCrypto.generateEntryId();
    const cryptoVersion = 1;

    const originalPayload = {
        type: "password",
        title: "Test Account",
        username: "testuser",
        password: "test-password-123"
    };

    const encrypted = await VaultCrypto.encryptPayload(
        originalPayload,
        result.vaultKey,
        entryId,
        cryptoVersion
    );

    const decrypted = await VaultCrypto.decryptPayload(
        encrypted.ciphertext,
        result.vaultKey,
        encrypted.iv,
        entryId,
        cryptoVersion
    );

    assert.deepEqual(decrypted, originalPayload);
});

test("unlock vault using the correct unlock secret", async () => {
    const unlockSecret = "my-test-vault-secret";

    // Create a new vault
    const setup = await VaultKeyDerivation.setupVault(unlockSecret);

    // Prepare metadata as if it came from MongoDB
    const vaultMetadata = {
        salt: setup.salt,
        iv: setup.iv,
        wrappedKey: setup.wrappedKey
    };

    // Lock and unlock the vault
    const recoveredVaultKey = await VaultKeyDerivation.unlockVault(
        unlockSecret,
        vaultMetadata
    );

    assert.equal(recoveredVaultKey.extractable, false);
    assert.equal(recoveredVaultKey.algorithm.name, "AES-GCM");

    // Verify the recovered key can decrypt an existing entry
    const entryId = VaultCrypto.generateEntryId();

    const originalPayload = {
        type: "note",
        title: "My private note",
        content: "This should survive locking and unlocking."
    };

    const encrypted = await VaultCrypto.encryptPayload(
        originalPayload,
        setup.vaultKey,
        entryId,
        1
    );

    const decrypted = await VaultCrypto.decryptPayload(
        encrypted.ciphertext,
        recoveredVaultKey,
        encrypted.iv,
        entryId,
        1
    );

    assert.deepEqual(decrypted, originalPayload);
});

test("incorrect unlock secret cannot unlock vault", async () => {
    const setup = await VaultKeyDerivation.setupVault(
        "correct-vault-secret"
    );

    const vaultMetadata = {
        salt: setup.salt,
        iv: setup.iv,
        wrappedKey: setup.wrappedKey
    };

    await assert.rejects(
        VaultKeyDerivation.unlockVault(
            "incorrect-vault-secret",
            vaultMetadata
        )
    );
});