const test = require("node:test");
const assert = require("node:assert/strict");
const { Binary } = require("mongodb");
const { serializeVaultEntry } = require("../src/utils/serialize-vault-entry");
const VaultCrypto = require("../src/public/js/crypto/crypto");

const testEntryId = VaultCrypto.generateEntryId();
const testUserId = VaultCrypto.generateEntryId();
const now = new Date()
const mockEntry = {
    _id: testEntryId,
    userId: testUserId,
    createdAt: now,
    updatedAt: now,
    cryptoVersion: 1,
    iv: new Binary(Buffer.from('AAAAAAAAAAAAAAAA', 'base64')),
    ciphertext: new Binary(Buffer.from('AQ==', 'base64'))
}

test("serialise vault entry", () => {
    const serialisedEntry = serializeVaultEntry(mockEntry);

    assert.equal(typeof serialisedEntry.entryId, 'string');
    assert.equal(serialisedEntry.userId, undefined);

    assert.deepEqual(serialisedEntry.createdAt, mockEntry.createdAt);
    assert.deepEqual(serialisedEntry.updatedAt, mockEntry.updatedAt);
});

test("serialise vault entry converts IV to Base64", () => {
    const serialisedEntry = serializeVaultEntry(mockEntry);

    const originalIV = mockEntry.iv.value(true);
    const decodedIV = Buffer.from(serialisedEntry.iv, 'base64');

    assert.deepEqual(decodedIV, originalIV);
});

test("serialise vault entry converts ciphertext to Base64", () => {
    const serialisedEntry = serializeVaultEntry(mockEntry);

    const originalCiphertext = mockEntry.ciphertext.value(true);
    const decodedCiphertext = Buffer.from(serialisedEntry.ciphertext, 'base64');

    assert.deepEqual(decodedCiphertext, originalCiphertext);
});