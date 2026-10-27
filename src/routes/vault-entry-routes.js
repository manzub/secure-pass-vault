const { vaultEntrySchema } = require('../schemas/vault-entry-schema');
const { validateVaultEntryCrypto } = require('../utils/crypto-validation');

async function vaultEntryRoutes(fastify, options) {
    const schema = {
        body: vaultEntrySchema
    }

    fastify.post('/api/vault-entries', { schema }, function (request, reply) {
        if(!validateVaultEntryCrypto(request.body)) return reply.code(400).send({ message: "Invalid IV or ciphertext" })
        return reply.send({ message: "Route reached" })
    })
}

module.exports = vaultEntryRoutes