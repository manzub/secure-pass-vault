const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const buildApp = require('../src/app');
const { ObjectId, Binary } = require('mongodb');
const { hashPassword } = require('../src/utils/password');
const { generateEntryId } = require('../src/public/js/crypto');
const VaultCrypto = require('../src/public/js/crypto');

let findCallCount = 0;
let capturedQuery;
let updateCallCount = 0;
let capturedUpdateQuery;
let capturedUpdate;
let deleteCallCount = 0;
let capturedDeleteQuery;
let insertCallCount = 0;
let capturedInsertedEntry = null;

const testUserId = new ObjectId();
const otherUserId = new ObjectId();
const testEmail = "test@example.com"
const testPassword = "myTestPassword123!"
let passwordHash;
before(async () => {
    passwordHash = await hashPassword(testPassword)
})

beforeEach(() => {
    findCallCount = 0;
    updateCallCount = 0
    deleteCallCount = 0
    insertCallCount = 0;
    capturedInsertedEntry = null;
    capturedUpdateQuery = undefined
    capturedUpdate = undefined
    capturedDeleteQuery = undefined
    capturedQuery = undefined;
});

const mockUsersCollection = {
    async findOne({ email }) {
        if (email != testEmail) return null

        const mockUser = {
            _id: testUserId,
            email,
            passwordHash,
            account_status: "pending_verification"
        }
        return mockUser
    }
}


const now = new Date()
const testEntryId = VaultCrypto.generateEntryId()
const testOwnedEntryId = VaultCrypto.generateEntryId()

const mockEntry = {
    _id: testEntryId,
    userId: otherUserId,
    createdAt: now,
    updatedAt: now,
    cryptoVersion: 1,
    iv: new Binary(Buffer.from('AAAAAAAAAAAAAAAA', 'base64')),
    ciphertext: new Binary(Buffer.from('AQ==', 'base64'))
}

const testOwnedEntry = {
    _id: testOwnedEntryId,
    userId: testUserId,
    createdAt: now,
    updatedAt: now,
    cryptoVersion: 1,
    iv: new Binary(Buffer.from('AAAAAAAAAAAAAAAA', 'base64')),
    ciphertext: new Binary(Buffer.from('AQ==', 'base64'))
}

const testEntries = [mockEntry, testOwnedEntry]

const mockVaultEntriesCollection = {
    find(query) {
        findCallCount++;
        capturedQuery = query;

        return {
            async toArray() {
                return testEntries;
            }
        }
    },
    async findOne(query) {
        findCallCount++
        capturedQuery = query;

        return testEntries.find(entry =>
            query._id?.equals(entry._id) &&
            query.userId?.equals(entry.userId)
        ) || null;
    },
    async updateOne(query, update) {
        updateCallCount++;
        capturedUpdateQuery = query
        capturedUpdate = update

        const ownsEntry = testEntries.some(entry =>
            query._id?.equals(entry._id) &&
            query.userId?.equals(entry.userId)
        );

        return {
            matchedCount: ownsEntry ? 1 : 0,
            modifiedCount: ownsEntry ? 1 : 0
        };
    },
    async deleteOne(query) {
        deleteCallCount++;
        capturedDeleteQuery = query

        const ownsEntry = testEntries.some(entry =>
            query._id?.equals(entry._id) &&
            query.userId?.equals(entry.userId)
        );

        return {
            deletedCount: ownsEntry ? 1 : 0
        }
    },
    async insertOne(document) {
        insertCallCount++;
        capturedInsertedEntry = document;

        testEntries.push(document);

        return {
            acknowledged: true,
            insertedId: document._id
        };
    },
}

const mockCollections = {
    usersCollection: mockUsersCollection,
    vaultEntriesCollection: mockVaultEntriesCollection
}

const app = buildApp(mockCollections, {
    sessionSecret: 'test-session-secret-that-is-at-least-32-characters',
    isDevelopment: true
})

async function loginResponse() {
    const loginResponse = await app.inject({ method: 'POST', url: '/api/login', body: { email: testEmail, password: testPassword } })
    assert.equal(loginResponse.statusCode, 200)

    const setCookie = loginResponse.headers['set-cookie']
    const sessionCookie = Array.isArray(setCookie)
        ? setCookie[0].split(';')[0]
        : setCookie.split(';')[0];

    return sessionCookie
}

test("Unauthenticated GET", async () => {
    const response = await app.inject({ method: 'GET', url: '/api/vault-entries' })

    assert.equal(findCallCount, 0);
    assert.equal(response.statusCode, 401)
})

test("GET all entries returns serialized vault entries", async () => {
    const sessionCookie = await loginResponse();

    const response = await app.inject({
        method: 'GET',
        url: '/api/vault-entries',
        headers: { cookie: sessionCookie }
    });

    assert.equal(response.statusCode, 200);

    const entries = response.json();

    assert.equal(Array.isArray(entries), true);

    assert.equal(entries.length, testEntries.length);

    assert.equal(typeof entries[0].entryId, 'string');
    assert.equal(typeof entries[0].iv, 'string');
    assert.equal(typeof entries[0].ciphertext, 'string');

    assert.equal(entries[0].userId, undefined);

    assert.equal(
        capturedQuery.userId.toString(),
        testUserId.toString()
    );
});

test("GET single entry returns serialized vault entry", async () => {
    const sessionCookie = await loginResponse();

    const response = await app.inject({
        method: 'GET',
        url: `/api/vault-entries/${testOwnedEntry._id}`,
        headers: { cookie: sessionCookie }
    });

    assert.equal(response.statusCode, 200);

    const entry = response.json();

    assert.equal(entry.entryId, testOwnedEntry._id.toString());
    assert.equal(typeof entry.iv, 'string');
    assert.equal(typeof entry.ciphertext, 'string');

    assert.equal(entry.userId, undefined);

    assert.deepEqual(
        Buffer.from(entry.iv, 'base64'),
        testOwnedEntry.iv.value(true)
    );

    assert.deepEqual(
        Buffer.from(entry.ciphertext, 'base64'),
        testOwnedEntry.ciphertext.value(true)
    );

    assert.equal(
        capturedQuery.userId.toString(),
        testUserId.toString()
    );
});

test("create new entry with valid entry ID", async () => {
    const sessionCookie = await loginResponse()

    const cryptoEntryId = generateEntryId()
    const response = await app.inject({
        method: 'POST',
        url: '/api/vault-entries',
        headers: { cookie: sessionCookie },
        body: { entryId: cryptoEntryId, cryptoVersion: 1, iv: "AAAAAAAAAAAAAAAA", ciphertext: "AQ==" }
    })

    assert.equal(response.statusCode, 201)
    assert.equal(insertCallCount, 1)
    assert.equal(response.json().entryId, cryptoEntryId.toString())
    assert.equal(capturedInsertedEntry._id.toString(), cryptoEntryId);

})

test("'GET' Invalid entry ID returns 400", async () => {
    const sessionCookie = await loginResponse()

    const response = await app.inject({
        method: 'GET',
        url: `/api/vault-entries/not-a-valid-object-id`,
        headers: { cookie: sessionCookie }
    })

    assert.equal(response.statusCode, 400)
    assert.equal(findCallCount, 0)
})

test("'PUT' Invalid entry ID returns 400", async () => {
    const sessionCookie = await loginResponse()

    const response = await app.inject({
        method: 'PUT',
        url: `/api/vault-entries/not-a-valid-object-id`,
        headers: { cookie: sessionCookie }
    })

    assert.equal(response.statusCode, 400)
    assert.equal(updateCallCount, 0)
})

test("'DELETE' Invalid entry ID returns 400", async () => {
    const sessionCookie = await loginResponse()

    const response = await app.inject({
        method: 'DELETE',
        url: `/api/vault-entries/not-a-valid-object-id`,
        headers: { cookie: sessionCookie }
    })

    assert.equal(response.statusCode, 400)
    assert.equal(findCallCount, 0)
})

test("get unauthorised entry denied", async () => {
    const sessionCookie = await loginResponse()

    // get unathorised vault entry
    const response = await app.inject({
        method: 'GET',
        url: `/api/vault-entries/${testEntryId}`,
        headers: { cookie: sessionCookie }
    })

    assert.equal(response.statusCode, 404)
    assert.equal(capturedQuery._id.toString(), testEntryId.toString());
    assert.equal(capturedQuery.userId.toString(), testUserId.toString());
})

test("cannot update entry without valid session", async () => {
    const response = await app.inject({
        method: 'PUT',
        url: `/api/vault-entries/${testEntryId}`,
        body: { cryptoVersion: 1, iv: "AAAAAAAAAAAAAAAA", ciphertext: "AQ==" }
    })
    assert.equal(updateCallCount, 0);
    assert.equal(response.statusCode, 401)
})

test("Invalid IV returns 400", async () => {
    const sessionCookie = await loginResponse()

    const response = await app.inject({
        method: 'PUT',
        url: `/api/vault-entries/${testOwnedEntryId}`,
        headers: { cookie: sessionCookie },
        body: { cryptoVersion: 1, iv: "invalid", ciphertext: "AQ==" }
    })

    assert.equal(response.statusCode, 400)
    assert.equal(updateCallCount, 0)
})


test("Unsupported cryptoVersion returns 400", async () => {
    const sessionCookie = await loginResponse()

    const response = await app.inject({
        method: 'PUT',
        url: `/api/vault-entries/${testOwnedEntryId}`,
        headers: { cookie: sessionCookie },
        body: { cryptoVersion: 999, iv: "AAAAAAAAAAAAAAAA", ciphertext: "AQ==" }
    })

    assert.equal(response.statusCode, 400)
    assert.equal(updateCallCount, 0)
})

test("Updating an entry that doesn't exist returns 404", async () => {
    const sessionCookie = await loginResponse()

    const response = await app.inject({
        method: 'PUT',
        url: `/api/vault-entries/${new ObjectId()}`,
        headers: { cookie: sessionCookie },
        body: { cryptoVersion: 1, iv: "AAAAAAAAAAAAAAAA", ciphertext: "AQ==" }
    })

    assert.equal(response.statusCode, 404)
    assert.equal(updateCallCount, 1);
    assert.equal(
        capturedUpdateQuery.userId.toString(),
        testUserId.toString()
    );
})

test("Invalid ciphertext returns 400", async () => {
    const sessionCookie = await loginResponse()

    const response = await app.inject({
        method: 'PUT',
        url: `/api/vault-entries/${testOwnedEntryId}`,
        headers: { cookie: sessionCookie },
        body: { cryptoVersion: 1, iv: "AAAAAAAAAAAAAAAA", ciphertext: null }
    })

    assert.equal(response.statusCode, 400)
})

test("cannot update another user's entry", async () => {
    const sessionCookie = await loginResponse()

    const response = await app.inject({
        method: 'PUT',
        url: `/api/vault-entries/${testEntryId}`,
        headers: { cookie: sessionCookie },
        body: { cryptoVersion: 1, iv: "AAAAAAAAAAAAAAAA", ciphertext: "AQ==" }
    })

    assert.equal(response.statusCode, 404)
    assert.equal(updateCallCount, 1)
    assert.equal(capturedUpdateQuery._id.toString(), testEntryId.toString());
    assert.equal(capturedUpdateQuery.userId.toString(), testUserId.toString());
    assert.equal(capturedUpdate.$set.userId, undefined);
    assert.ok(capturedUpdate.$set.iv);
    assert.ok(capturedUpdate.$set.ciphertext);
    assert.ok(capturedUpdate.$set.updatedAt);
});

test("authorised update own entry", async () => {
    const sessionCookie = await loginResponse()

    const response = await app.inject({
        method: 'PUT',
        url: `/api/vault-entries/${testOwnedEntryId}`,
        headers: { cookie: sessionCookie },
        body: { cryptoVersion: 1, iv: "AAAAAAAAAAAAAAAA", ciphertext: "AQ==" }
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json().message, "Vault entry updated successfully");
    assert.equal(updateCallCount, 1)
    assert.equal(capturedUpdateQuery._id.toString(), testOwnedEntryId.toString());
    assert.equal(capturedUpdateQuery.userId.toString(), testUserId.toString());
    assert.equal(capturedUpdate.$set.userId, undefined);
    assert.ok(capturedUpdate.$set.iv);
    assert.ok(capturedUpdate.$set.ciphertext);
    assert.ok(capturedUpdate.$set.updatedAt);
})

test("cannot delete another user's entry", async () => {
    const sessionCookie = await loginResponse()

    const response = await app.inject({
        method: 'DELETE',
        url: `/api/vault-entries/${testEntryId}`,
        headers: { cookie: sessionCookie }
    })

    assert.equal(response.statusCode, 404)
    assert.equal(deleteCallCount, 1)
    assert.equal(capturedDeleteQuery._id.toString(), testEntryId.toString());
    assert.equal(capturedDeleteQuery.userId.toString(), testUserId.toString());
});

test("cannot delete entry without valid session", async () => {
    const response = await app.inject({
        method: 'DELETE',
        url: `/api/vault-entries/${testEntryId}`,
    })
    assert.equal(deleteCallCount, 0);
    assert.equal(response.statusCode, 401)
})

test("authorised delete own entry", async () => {
    const sessionCookie = await loginResponse()

    const response = await app.inject({
        method: 'DELETE',
        url: `/api/vault-entries/${testOwnedEntryId}`,
        headers: { cookie: sessionCookie },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json().message, "Vault entry deleted successfully");
    assert.equal(deleteCallCount, 1)
    assert.equal(capturedDeleteQuery._id.toString(), testOwnedEntryId.toString());
    assert.equal(capturedDeleteQuery.userId.toString(), testUserId.toString());
})

test("create, retrieve and decrypt a vault entry", async () => {
    const sessionCookie = await loginResponse();

    const entryId = VaultCrypto.generateEntryId()
    const encryptionKey = await VaultCrypto.generateEncryptionKey();
    const cryptoVersion = 1;

    const originalPayload = {
        type: "password",
        title: "Test Account",
        username: "testuser",
        password: "test-password-123"
    };

    const encrypted = await VaultCrypto.encryptPayload(originalPayload, encryptionKey, entryId, cryptoVersion)

    const iv = VaultCrypto.arrayBufferToBase64(encrypted.iv);
    const ciphertext = VaultCrypto.arrayBufferToBase64(encrypted.ciphertext);

    const createResponse = await app.inject({
        method: "POST",
        url: "/api/vault-entries",
        headers: {
            cookie: sessionCookie
        },
        payload: {
            entryId,
            cryptoVersion,
            iv,
            ciphertext
        }
    });

    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().entryId, entryId);

    const getResponse = await app.inject({
        method: "GET",
        url: `/api/vault-entries/${entryId}`,
        headers: {
            cookie: sessionCookie
        }
    });

    assert.equal(getResponse.statusCode, 200);

    const retrievedEntry = getResponse.json();

    assert.equal(retrievedEntry.entryId, entryId);
    assert.equal(retrievedEntry.cryptoVersion, cryptoVersion);

    const retrievedIV = VaultCrypto.base64ToArrayBuffer(retrievedEntry.iv);
    const retrievedCiphertext = VaultCrypto.base64ToArrayBuffer(retrievedEntry.ciphertext);

    const decryptedPayload = await VaultCrypto.decryptPayload(
        retrievedCiphertext,
        encryptionKey,
        retrievedIV,
        entryId,
        cryptoVersion
    );

    assert.deepEqual(decryptedPayload, originalPayload);

});

after(async () => {
    await app.close();
});