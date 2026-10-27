const test = require("node:test");
const assert = require("node:assert/strict");

const { validateVaultEntryCrypto } = require("../src/utils/crypto-validation");

test("Valid 12-byte IV and valid ciphertext", () => {
    assert.equal(validateVaultEntryCrypto({iv:"5PGik7WMcdIGpLPw", ciphertext:"SGVsbG8="}), true);
});

test("rejects 11 byte IV", () => {
    assert.equal(validateVaultEntryCrypto({iv:"5PGik7WMcdIGPw", ciphertext:"SGVsbG8="}), false);
});

test("rejects empty ciphertext", () => {
    assert.equal(validateVaultEntryCrypto({iv:"5PGik7WMcdIGPw", ciphertext:""}), false);
});

test("null argument", () => {
    assert.equal(validateVaultEntryCrypto(null), false);
});