const test = require("node:test");
const assert = require("node:assert/strict");

const createVaultState = require("../src/public/js/workers/vault-state");

test("vault starts locked", () => {
    const state = createVaultState();

    assert.equal(state.isUnlocked(), false);
    assert.equal(state.getKey(), null);
    assert.equal(state.getOwnerId(), null);
});

test("unlock stores the key and owner identity", () => {
    const key = { id: "mock-key" };
    const ownerId = "user-123";

    const state = createVaultState();

    state.unlock(key, ownerId, state.getGeneration());

    assert.equal(state.isUnlocked(), true);
    assert.equal(state.getKey(), key);
    assert.equal(state.getOwnerId(), ownerId);
});

test("locking clears the key and owner identity", () => {
    const state = createVaultState();
    const generation = state.getGeneration()

    state.unlock({ id: "mock-key" }, "user-123", generation);

    state.lock();

    assert.equal(state.isUnlocked(), false);
    assert.equal(state.getKey(), null);
    assert.equal(state.getOwnerId(), null);
});

test("locking invalidates an earlier operation generation", () => {
    const state = createVaultState();

    const generation = state.getGeneration();

    assert.equal(state.isCurrent(generation), true);

    state.lock();

    assert.equal(state.isCurrent(generation), false);
});

test("stale operation cannot overwrite a newer vault state", () => {
    const state = createVaultState();

    const oldGeneration = state.getGeneration();

    state.lock();
    state.unlock({ id: "new-key" }, "user-456", state.getGeneration());

    if (state.isCurrent(oldGeneration)) {
        state.unlock({ id: "old-key" }, "user-123", state.getGeneration());
    }

    assert.equal(state.getKey().id, "new-key");
    assert.equal(state.getOwnerId(), "user-456");
    assert.equal(state.isCurrent(oldGeneration), false);
});

test("stale operation cannot clear a newer vault state", () => {
    const state = createVaultState();

    const oldGeneration = state.getGeneration();

    state.lock();
    state.unlock({ id: "new-key" }, "user-456", state.getGeneration());

    if (state.isCurrent(oldGeneration)) {
        state.lock();
    }

    assert.equal(state.isUnlocked(), true);
    assert.equal(state.getKey().id, "new-key");
});

test("unlock rejects a stale generation", () => {
    const state = createVaultState();

    const oldGeneration = state.getGeneration();

    state.lock();

    state.unlock(
        { id: "new-key" },
        "user-456",
        state.getGeneration()
    );

    assert.throws(
        () => state.unlock(
            { id: "old-key" },
            "user-123",
            oldGeneration
        ),
        /Stale vault operation/
    );

    assert.equal(state.isUnlocked(), true);
    assert.equal(state.getKey().id, "new-key");
    assert.equal(state.getOwnerId(), "user-456");
});

test("lockIfCurrent locks the current vault generation", () => {
    const state = createVaultState();

    const generation = state.getGeneration();

    state.unlock({ id: "key-1" }, "user-123", generation);

    const result = state.lockIfCurrent(generation);

    assert.equal(result, true);
    assert.equal(state.isUnlocked(), false);
    assert.equal(state.getKey(), null);
    assert.equal(state.isCurrent(generation), false);
});

test("lockIfCurrent cannot clear a newer vault state", () => {
    const state = createVaultState();

    const oldGeneration = state.getGeneration();

    state.lock();

    const newGeneration = state.getGeneration();

    state.unlock({ id: "new-key" }, "user-456", newGeneration);

    const result = state.lockIfCurrent(oldGeneration);

    assert.equal(result, false);
    assert.equal(state.isUnlocked(), true);
    assert.equal(state.getKey().id, "new-key");
    assert.equal(state.getOwnerId(), "user-456");
    assert.equal(state.getGeneration(), newGeneration);
});