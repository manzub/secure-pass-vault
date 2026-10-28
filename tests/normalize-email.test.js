const test = require("node:test");
const assert = require("node:assert/strict");
const normalizeEmail = require("../src/utils/normalize-email");

test("Assert mixed-case email", () => {
    assert.equal(normalizeEmail("User@example.com"), "user@example.com")
})

test("Assert whitespaces email", () => {
    assert.equal(normalizeEmail('  User@example.com '), "user@example.com")
})

test("Assert already normalised email", () => {
    assert.equal(normalizeEmail('user@example.com'), "user@example.com")
})

