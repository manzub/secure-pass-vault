const test = require("node:test");
const assert = require("node:assert/strict");

const VaultSetup = require("../src/public/js/vault-setup");
const { validateVaultSettingsCrypto } = require("../src/utils/vault-settings-validation");

test("initialiseVault generates valid encrypted vault metadata", async () => {
    const unlockSecret = "MySecureVaultSecret123!";

    const { payload, vaultKey } = await VaultSetup.initialiseVault(unlockSecret);

    // Verify the generated payload passes backend validation
    assert.equal(validateVaultSettingsCrypto(payload), true);

    // Verify the metadata structure
    assert.equal(payload.cryptoVersion, 1);
    assert.equal(payload.kdf.algorithm, "argon2id");

    // Verify sensitive values are excluded from the API payload
    assert.equal(payload.vaultKey, undefined);
    assert.equal(payload.unlockSecret, undefined);

    // Verify the vault key remains available locally
    assert.equal(vaultKey.type, "secret");
    assert.equal(vaultKey.extractable, false);
    assert.deepEqual(vaultKey.usages, ["encrypt", "decrypt"]);
});

test("saveVaultSettings sends encrypted metadata to the API", async (t) => {
    const payload = {
        cryptoVersion: 1,
        salt: "test-salt",
        wrapIv: "test-iv",
        wrappedVaultKey: "test-wrapped-key",
        kdf: {
            algorithm: "argon2id",
            iterations: 3,
            parallelism: 1,
            memorySize: 65536,
            hashLength: 32
        }
    };

    let capturedUrl;
    let capturedOptions;

    t.mock.method(globalThis, "fetch", async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;

        return {
            ok: true,
            status: 201,
            json: async () => ({
                message: "Vault initialised successfully"
            })
        };
    });

    const result = await VaultSetup.saveVaultSettings(payload);

    assert.equal(capturedUrl, "/api/vault/settings");
    assert.equal(capturedOptions.method, "POST");
    assert.equal(capturedOptions.credentials, "same-origin");

    assert.equal(
        capturedOptions.headers["Content-Type"],
        "application/json"
    );

    assert.deepEqual(
        JSON.parse(capturedOptions.body),
        payload
    );

    assert.deepEqual(result, {
        message: "Vault initialised successfully"
    });
});

test("saveVaultSettings throws when vault is already initialised", async (t) => {
    t.mock.method(globalThis, "fetch", async () => ({
        ok: false,
        status: 409,
        json: async () => ({
            message: "Vault already initialised"
        })
    }));

    await assert.rejects(
        VaultSetup.saveVaultSettings({}),
        {
            name: "Error",
            message: "Vault already initialised"
        }
    );
});