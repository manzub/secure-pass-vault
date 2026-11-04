const test = require("node:test");
const assert = require("node:assert/strict");
const { generateEncryptionKey, encryptPayload, decryptPayload } = require("../src/public/js/crypto");
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