const test = require("node:test");
const assert = require("node:assert/strict");
const { generateEncryptionKey, encryptPayload, decryptPayload, arrayBufferToBase64, base64ToArrayBuffer } = require("../src/public/js/crypto");
const { ObjectId } = require("mongodb");

const testUserId = new ObjectId()
const testEntryId = new ObjectId()
const additionalData = new TextEncoder().encode(
    `${testUserId}:${testEntryId}:1`
);

const testPayload = {
    type: "password",
    website: "github.com",
    username: "wizz",
    password: "secret123"
};

test("test encryption and decryption pipeline", async () => {
    const encryptionKey = await generateEncryptionKey()
    const { iv, ciphertext } = await encryptPayload(testPayload, encryptionKey, additionalData)
    const decrypted = await decryptPayload(ciphertext, encryptionKey, iv, additionalData)
    assert.deepEqual(testPayload, decrypted)
})

test("encrypted payload returns different ivs", async () => {
    const encryptionKey = await generateEncryptionKey()
    const first = await encryptPayload(testPayload, encryptionKey, additionalData)
    const second = await encryptPayload(testPayload, encryptionKey, additionalData)
    assert.notDeepEqual(first.iv, second.iv)
})

test("modified ciphertext rejects decryption", async () => {
    const encryptionKey = await generateEncryptionKey()
    const first = await encryptPayload(testPayload, encryptionKey, additionalData)
    let tamperedCiphertext = `${first.ciphertext}=`
    await assert.rejects(
        decryptPayload(tamperedCiphertext, encryptionKey, first.iv, additionalData)
    );
})

test("different AAD rejects decryption", async () => {
    const falseAdditionalData = new TextEncoder().encode(
        `${testUserId}:${new ObjectId()}:1`
    );
    const encryptionKey = await generateEncryptionKey()
    const first = await encryptPayload(testPayload, encryptionKey, additionalData)
    await assert.rejects(
        decryptPayload(first.ciphertext, encryptionKey, first.iv, falseAdditionalData)
    );
})

test("encoding and decoding preserve original data", () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]);

    const encoded = arrayBufferToBase64(original)
    const decoded = base64ToArrayBuffer(encoded)

    assert.deepEqual(
        new Uint8Array(decoded),
        original
    );
})

test("encoding and decoding payload preserve original data", async () => {
    const original = new TextEncoder().encode(
        JSON.stringify(testPayload)
    );

    const encoded = arrayBufferToBase64(original);
    const decoded = base64ToArrayBuffer(encoded);

    const decodedPayload = JSON.parse(
        new TextDecoder().decode(decoded)
    );

    assert.deepEqual(decodedPayload, testPayload);
})

test("encrypted payload survives Base64 conversion", async () => {
    const encryptionKey = await generateEncryptionKey()

    const { iv, ciphertext } = await encryptPayload(
        testPayload,
        encryptionKey,
        additionalData
    );

    const encodedIV = arrayBufferToBase64(iv);
    const encodedCiphertext = arrayBufferToBase64(ciphertext);

    const decodedIV = base64ToArrayBuffer(encodedIV);
    const decodedCiphertext = base64ToArrayBuffer(encodedCiphertext);

    // Decrypt using reconstructed values
    const decrypted = await decryptPayload(
        decodedCiphertext,
        encryptionKey,
        decodedIV,
        additionalData
    );

    assert.deepEqual(decrypted, testPayload);
});