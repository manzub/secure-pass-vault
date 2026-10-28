const test = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword } = require("../src/utils/password")

test("hashPassword does not return the original password", async () => {
    const password = "MySecurePassword123!";
    const hash = await hashPassword(password);

    assert.notEqual(hash, password);
});

test("verifyPassword accepts the correct password", async () => {
    const password = "MySecurePassword123!";
    const hash = await hashPassword(password);

    assert.equal(await verifyPassword(hash, password), true);
});

test("verifyPassword rejects an incorrect password", async () => {
    const password = "MySecurePassword123!";
    const hash = await hashPassword(password);

    assert.equal(await verifyPassword(hash, "WrongPassword123!"), false);
});

test("hashPassword generates different hashes for the same password", async () => {
    const password = "MySecurePassword123!";

    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    assert.notEqual(firstHash, secondHash);
    assert.equal(await verifyPassword(firstHash, password), true);
    assert.equal(await verifyPassword(secondHash, password), true);
});