const test = require("node:test");
const assert = require("node:assert/strict");
const VaultCrypto = require("../src/public/js/crypto/crypto");
const { ObjectId } = require("mongodb");

const testUserId = new ObjectId()
const testEntryId = VaultCrypto.generateEntryId()
const additionalData = new TextEncoder().encode(
    `${testUserId}:${testEntryId}:1`
);

const testPayload = {
    type: "password",
    website: "github.com",
    username: "wizz",
    password: "secret123"
};

test("encrypted AAD bytes decode to original string", () => {
    let encodedAAD = VaultCrypto.generateAAD(testEntryId, 1)
    let decodedAAD = new TextDecoder().decode(encodedAAD)
    assert.equal(decodedAAD, `${testEntryId}:1`)
})

test("test generate entry ID", () => {
    assert.equal(typeof testEntryId, 'string');
    assert.equal(testEntryId.length, 24);
    assert.match(testEntryId, /^[0-9a-f]{24}$/);
})

test('generateEntryId generates unique IDs', () => {
    const firstId = VaultCrypto.generateEntryId();
    const secondId = VaultCrypto.generateEntryId();

    assert.notEqual(firstId, secondId);
});

test("test encryption and decryption pipeline", async () => {
    const encryptionKey = await VaultCrypto.generateEncryptionKey()
    const { iv, ciphertext } = await VaultCrypto.encryptPayload(testPayload, encryptionKey, additionalData)
    const decrypted = await VaultCrypto.decryptPayload(ciphertext, encryptionKey, iv, additionalData)
    assert.deepEqual(testPayload, decrypted)
})

test("encrypted payload returns different ivs", async () => {
    const encryptionKey = await VaultCrypto.generateEncryptionKey()
    const first = await VaultCrypto.encryptPayload(testPayload, encryptionKey, additionalData)
    const second = await VaultCrypto.encryptPayload(testPayload, encryptionKey, additionalData)
    assert.notDeepEqual(first.iv, second.iv)
})

test("modified ciphertext rejects decryption", async () => {
    const encryptionKey = await VaultCrypto.generateEncryptionKey()
    const first = await VaultCrypto.encryptPayload(testPayload, encryptionKey, additionalData)
    let tamperedCiphertext = `${first.ciphertext}=`
    await assert.rejects(
        VaultCrypto.decryptPayload(tamperedCiphertext, encryptionKey, first.iv, additionalData)
    );
})

test("different AAD rejects decryption", async () => {
    const falseAdditionalData = new TextEncoder().encode(
        `${testUserId}:${new ObjectId()}:1`
    );
    const encryptionKey = await VaultCrypto.generateEncryptionKey()
    const first = await VaultCrypto.encryptPayload(testPayload, encryptionKey, additionalData)
    await assert.rejects(
        VaultCrypto.decryptPayload(first.ciphertext, encryptionKey, first.iv, falseAdditionalData)
    );
})

test("encoding and decoding preserve original data", () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]);

    const encoded = VaultCrypto.arrayBufferToBase64(original)
    const decoded = VaultCrypto.base64ToArrayBuffer(encoded)

    assert.deepEqual(
        new Uint8Array(decoded),
        original
    );
})

test("encoding and decoding payload preserve original data", async () => {
    const original = new TextEncoder().encode(
        JSON.stringify(testPayload)
    );

    const encoded = VaultCrypto.arrayBufferToBase64(original);
    const decoded = VaultCrypto.base64ToArrayBuffer(encoded);

    const decodedPayload = JSON.parse(
        new TextDecoder().decode(decoded)
    );

    assert.deepEqual(decodedPayload, testPayload);
})

test("encrypted payload survives Base64 conversion", async () => {
    const encryptionKey = await VaultCrypto.generateEncryptionKey()

    const { iv, ciphertext } = await VaultCrypto.encryptPayload(
        testPayload,
        encryptionKey,
        additionalData
    );

    const encodedIV = VaultCrypto.arrayBufferToBase64(iv);
    const encodedCiphertext = VaultCrypto.arrayBufferToBase64(ciphertext);

    const decodedIV = VaultCrypto.base64ToArrayBuffer(encodedIV);
    const decodedCiphertext = VaultCrypto.base64ToArrayBuffer(encodedCiphertext);

    // Decrypt using reconstructed values
    const decrypted = await VaultCrypto.decryptPayload(
        decodedCiphertext,
        encryptionKey,
        decodedIV,
        additionalData
    );

    assert.deepEqual(decrypted, testPayload);
});

test('decrypts payload with matching AAD', async () => {
    const key = await VaultCrypto.generateEncryptionKey();
    const entryId = VaultCrypto.generateEntryId();
    const cryptoVersion = 1;

    const payload = { title: 'Test entry', content: 'Secret data' };

    const encrypted = await VaultCrypto.encryptPayload(
        payload, key, entryId, cryptoVersion
    );

    const decrypted = await VaultCrypto.decryptPayload(
        encrypted.ciphertext,
        key,
        encrypted.iv,
        entryId,
        cryptoVersion
    );

    assert.deepEqual(decrypted, payload);
});

test('rejects decryption with incorrect entry ID', async () => {
    const key = await VaultCrypto.generateEncryptionKey();
    const entryId = VaultCrypto.generateEntryId();
    const wrongEntryId = VaultCrypto.generateEntryId();

    const encrypted = await VaultCrypto.encryptPayload(
        { title: 'Test' }, key, entryId, 1
    );

    await assert.rejects(
        VaultCrypto.decryptPayload(
            encrypted.ciphertext,
            key,
            encrypted.iv,
            wrongEntryId,
            1
        )
    );
});

test('rejects decryption with incorrect crypto version', async () => {
    const key = await VaultCrypto.generateEncryptionKey();
    const entryId = VaultCrypto.generateEntryId();

    const encrypted = await VaultCrypto.encryptPayload(
        { title: 'Test' }, key, entryId, 1
    );

    await assert.rejects(
        VaultCrypto.decryptPayload(
            encrypted.ciphertext,
            key,
            encrypted.iv,
            entryId,
            2
        )
    );
});

test('rejects modified ciphertext', async () => {
    const key = await VaultCrypto.generateEncryptionKey();
    const entryId = VaultCrypto.generateEntryId();

    const encrypted = await VaultCrypto.encryptPayload(
        { title: 'Test' }, key, entryId, 1
    );

    const modified = new Uint8Array(encrypted.ciphertext);
    modified[0] ^= 1;

    await assert.rejects(
        VaultCrypto.decryptPayload(
            modified.buffer,
            key,
            encrypted.iv,
            entryId,
            1
        )
    );
});