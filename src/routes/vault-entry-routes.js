const { ObjectId, Binary } = require('bson');
const requireAuth = require('../hooks/require-auth');
const { updateVaultEntrySchema, createVaultEntrySchema } = require('../schemas/vault-entry-schema');
const { validateVaultEntryCrypto } = require('../utils/crypto-validation');
const { serializeVaultEntry } = require('../utils/serialize-vault-entry');

async function vaultEntryRoutes(fastify, options) {

    // GET ALL ENTRIES
    fastify.get('/api/vault-entries', { preHandler: requireAuth }, async function (request, reply) {
        if (!ObjectId.isValid(request.session.userId)) return reply.code(401).send({ message: "Invalid authentication session" });

        try {
            const userId = new ObjectId(request.session.userId)

            const entries = await options.vaultEntriesCollection.find({ userId }).toArray()

            const serializedEntries = entries.map(serializeVaultEntry)

            return reply.code(200).send(serializedEntries)
        } catch (error) {
            fastify.log.error(error)
            return reply.code(500).send({ message: "An error occurred" })
        }

    })

    // GET SINGLE ENTRY
    fastify.get('/api/vault-entries/:id', { preHandler: requireAuth }, async function (request, reply) {
        if (!ObjectId.isValid(request.params.id)) return reply.code(400).send({ message: "Invalid entry ID" });

        try {
            const userId = new ObjectId(request.session.userId)
            const singleEntry = await options.vaultEntriesCollection.findOne({ _id: new ObjectId(request.params.id), userId: userId })

            if (!singleEntry) {
                return reply.code(404).send({
                    message: "Vault entry not found"
                });
            }

            return reply.code(200).send(serializeVaultEntry(singleEntry))
        } catch (error) {
            fastify.log.error(error)
            return reply.code(500).send({ message: "An error occurred" })
        }
    })

    // UPDATE RECORD
    fastify.put('/api/vault-entries/:id', { schema: { body: updateVaultEntrySchema }, preHandler: requireAuth }, async function (request, reply) {
        if (!ObjectId.isValid(request.params.id)) return reply.code(400).send({ message: "Invalid entry ID" });

        if (!validateVaultEntryCrypto(request.body)) return reply.code(400).send({ message: "Invalid IV or ciphertext" })

        try {
            const now = new Date()
            const userId = new ObjectId(request.session.userId)
            const iv = new Binary(Buffer.from(request.body.iv, 'base64'));
            const ciphertext = new Binary(Buffer.from(request.body.ciphertext, 'base64'));
            const entry = { updatedAt: now, cryptoVersion: request.body.cryptoVersion, iv, ciphertext }

            const resp = await options.vaultEntriesCollection.updateOne({ _id: new ObjectId(request.params.id), userId: userId }, { $set: entry })

            if (resp.matchedCount === 0) return reply.code(404).send({ message: "Vault entry not found" });

            return reply.code(200).send({ message: "Vault entry updated successfully" });
        } catch (error) {
            fastify.log.error(error)
            return reply.code(500).send({ message: "An error occurred" })
        }
    })

    // CREATE NEW ENTRY
    fastify.post('/api/vault-entries', { schema: { body: createVaultEntrySchema }, preHandler: requireAuth }, async function (request, reply) {
        if (!validateVaultEntryCrypto(request.body)) return reply.code(400).send({ message: "Invalid IV or ciphertext" })

        try {
            const ivBuffer = Buffer.from(request.body.iv, 'base64');
            const ciphertextBuffer = Buffer.from(request.body.ciphertext, 'base64');

            if (!ObjectId.isValid(request.session.userId)) return reply.code(401).send({ message: "Authentication required" });

            if (!ObjectId.isValid(request.body.entryId)) return reply.code(400).send({ message: "Valid Entry Id required" });

            const now = new Date();
            const entryId = new ObjectId(request.body.entryId);
            const newEntry = {
                _id: entryId,
                userId: new ObjectId(request.session.userId),
                createdAt: now,
                updatedAt: now,
                cryptoVersion: request.body.cryptoVersion,
                iv: new Binary(ivBuffer),
                ciphertext: new Binary(ciphertextBuffer)
            }
            await options.vaultEntriesCollection.insertOne(newEntry);
            return reply.code(201).send({ message: "Vault Entry saved successful", entryId: entryId.toString() })
        } catch (error) {
            fastify.log.error(error)

            if (error.code === 11000) {
                return reply.code(409).send({
                    message: "Entry ID already exists"
                });
            }
            return reply.code(500).send({ message: "An error occurred" })
        }
    })

    // DELETE ONE ENTRY
    fastify.delete('/api/vault-entries/:id', { preHandler: requireAuth }, async function (request, reply) {
        if (!ObjectId.isValid(request.params.id)) return reply.code(400).send({ message: "Invalid entry ID" });

        try {
            const userId = new ObjectId(request.session.userId)
            const entryId = new ObjectId(request.params.id)

            const resp = await options.vaultEntriesCollection.deleteOne({ _id: entryId, userId })
            if (resp.deletedCount === 0) return reply.code(404).send({ message: "Vault entry not found" });

            return reply.code(200).send({ message: "Vault entry deleted successfully" });
        } catch (error) {
            fastify.log.error(error)
            return reply.code(500).send({ message: "An error occurred" })
        }
    })
}

module.exports = vaultEntryRoutes