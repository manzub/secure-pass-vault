const { test, after, before } = require("node:test");
const assert = require("node:assert/strict");
const buildApp = require("../src/app");
const { ObjectId, Binary } = require("bson");
const argon2 = require("argon2");

const testEmail = "vault-test@example.com";
const testPassword = "TestPassword123!";
const testUserId = new ObjectId();

let insertedVaultSettings = null;
let simulateDuplicate = false;

let mockUser;

before(async () => {
    mockUser = {
        _id: testUserId,
        email: testEmail,
        passwordHash: await argon2.hash(testPassword),
        account_status: "active"
    };
});

const { randomBytes } = require("node:crypto");

const validPayload = {
    cryptoVersion: 1,
    salt: randomBytes(16).toString("base64"),
    wrapIv: randomBytes(12).toString("base64"),
    wrappedVaultKey: randomBytes(48).toString("base64"),
    kdf: {
        algorithm: "argon2id",
        iterations: 3,
        parallelism: 1,
        memorySize: 65536,
        hashLength: 32
    }
};

const app = buildApp(
    {
        usersCollection: {
            findOne: async (query) => {
                if (query.email === testEmail) return mockUser;
                return null;
            }
        },
        vaultEntriesCollection: {},
        vaultSettingsCollection: {
            insertOne: async (document) => {
                if (simulateDuplicate) {
                    const error = new Error("E11000 duplicate key error");
                    error.code = 11000;
                    throw error;
                }

                insertedVaultSettings = document;

                return {
                    acknowledged: true,
                    insertedId: new ObjectId()
                };
            },
            findOne: async (query) => {
                if (
                    insertedVaultSettings &&
                    insertedVaultSettings.userId.equals(query.userId)
                ) {
                    return insertedVaultSettings;
                }

                return null;
            }
        }
    },
    {
        sessionSecret: "a-test-session-secret-at-least-32-characters-long",
        isDevelopment: true
    }
)

async function loginResponse() {
    const loginResponse = await app.inject({ method: 'POST', url: '/api/login', body: { email: testEmail, password: testPassword } })
    assert.equal(loginResponse.statusCode, 200)

    const setCookie = loginResponse.headers['set-cookie']
    const sessionCookie = Array.isArray(setCookie)
        ? setCookie[0].split(';')[0]
        : setCookie.split(';')[0];

    return sessionCookie
}

test("GET /api/vault/settings rejects unauthenticated requests", async () => {
    const response = await app.inject({
        method: "GET",
        url: "/api/vault/settings"
    });

    assert.equal(response.statusCode, 401);

    assert.deepEqual(response.json(), {
        message: "Authentication required"
    });
});

test("POST /api/vault/settings rejects unauthenticated requests", async () => {
    const response = await app.inject({
        method: "POST",
        url: "/api/vault/settings",
        payload: validPayload
    });

    assert.equal(response.statusCode, 401);
    assert.equal(
        response.json().message,
        "Authentication required"
    );
})

test("POST /api/vault/settings rejects invalid schema", async () => {
    const cookie = await loginResponse();

    const response = await app.inject({
        method: "POST",
        url: "/api/vault/settings",
        headers: {
            cookie
        },
        payload: {
            ...validPayload,
            cryptoVersion: 2
        }
    });

    assert.equal(response.statusCode, 400);
});

test("POST /api/vault/settings rejects invalid Base64 data", async () => {
    const cookie = await loginResponse();

    const response = await app.inject({
        method: "POST",
        url: "/api/vault/settings",
        headers: {
            cookie
        },
        payload: {
            ...validPayload,
            salt: "!".repeat(24)
        }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), {
        message: "Invalid Vault Settings"
    });
});

test("POST /api/vault/settings stores encrypted vault settings", async () => {
    insertedVaultSettings = null;

    const cookie = await loginResponse();

    const response = await app.inject({
        method: "POST",
        url: "/api/vault/settings",
        headers: { cookie },
        payload: validPayload
    });

    assert.equal(response.statusCode, 201);

    assert.ok(insertedVaultSettings);

    assert.equal(
        insertedVaultSettings.userId.toString(),
        testUserId.toString()
    );

    assert.equal(insertedVaultSettings.cryptoVersion, 1);

    assert.equal(
        insertedVaultSettings.salt.value(true).toString("base64"),
        validPayload.salt
    );

    assert.equal(
        insertedVaultSettings.wrapIv.value(true).toString("base64"),
        validPayload.wrapIv
    );

    assert.equal(
        insertedVaultSettings.wrappedVaultKey.value(true).toString("base64"),
        validPayload.wrappedVaultKey
    );

    assert.deepEqual(insertedVaultSettings.kdf, validPayload.kdf);

    assert.ok(insertedVaultSettings.createdAt instanceof Date);
    assert.ok(insertedVaultSettings.updatedAt instanceof Date);
});

test("POST /api/vault/settings rejects duplicate vault setup", async () => {
    simulateDuplicate = true;

    try {
        const cookie = await loginResponse();

        const response = await app.inject({
            method: "POST",
            url: "/api/vault/settings",
            headers: { cookie },
            payload: validPayload
        });

        assert.equal(response.statusCode, 409);
        assert.deepEqual(response.json(), {
            message: "Vault already initialised"
        });
    } finally {
        simulateDuplicate = false;
    }
});

test("GET /api/vault/settings returns the user's vault configuration", async () => {
    const cookie = await loginResponse();

    insertedVaultSettings = {
        userId: testUserId,
        cryptoVersion: validPayload.cryptoVersion,
        salt: new Binary(Buffer.from(validPayload.salt, "base64")),
        wrapIv: new Binary(Buffer.from(validPayload.wrapIv, "base64")),
        wrappedVaultKey: new Binary(Buffer.from(validPayload.wrappedVaultKey, "base64")),
        kdf: validPayload.kdf,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const response = await app.inject({
        method: "GET",
        url: "/api/vault/settings",
        headers: { cookie }
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();

    assert.equal(body.cryptoVersion, 1);
    assert.equal(body.salt, validPayload.salt);
    assert.equal(body.wrapIv, validPayload.wrapIv);
    assert.equal(body.wrappedVaultKey, validPayload.wrappedVaultKey);
    assert.deepEqual(body.kdf, validPayload.kdf);

    assert.equal(body._id, undefined);
    assert.equal(body.userId, undefined);
    assert.equal(body.createdAt, undefined);
    assert.equal(body.updatedAt, undefined);
});

test("GET /api/vault/settings returns 404 when vault is not initialised", async () => {
    const cookie = await loginResponse();

    // Simulate a user with no vault settings
    insertedVaultSettings = null;

    const response = await app.inject({
        method: "GET",
        url: "/api/vault/settings",
        headers: { cookie }
    });

    assert.equal(response.statusCode, 404);

    assert.deepEqual(response.json(), {
        message: "No vault settings found"
    });
});

after(async () => {
    await app.close()
})