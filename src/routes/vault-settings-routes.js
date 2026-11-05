const { ObjectId, Binary } = require("mongodb");
const requireAuth = require("../hooks/require-auth")
const { createVaultSettingsSchema } = require("../schemas/vault-settings-schema");
const { validateVaultSettingsCrypto } = require("../utils/vault-settings-validation");
const { serializeVaultSettings } = require("../utils/serialize-vault-settings");

async function vaultSettingsRoutes(fastify, options) {
    const { vaultSettingsCollection } = options;

    fastify.get('/api/vault/settings', { preHandler: requireAuth }, async function (request, reply) {
        if (!ObjectId.isValid(request.session?.userId)) return reply.code(401).send({ message: "Authentication required" });

        try {
            const userId = new ObjectId(request.session.userId)
            const vaultSettings = await vaultSettingsCollection.findOne({ userId })

            if (!vaultSettings) {
                return reply.code(404).send({
                    message: "No vault settings found"
                });
            }

            return reply.code(200).send(serializeVaultSettings(vaultSettings))
        } catch (error) {
            fastify.log.error(error);

            return reply.code(500).send({
                message: "An error occurred"
            });
        }
    })

    fastify.post('/api/vault/settings', { schema: { body: createVaultSettingsSchema }, preHandler: requireAuth }, async (request, reply) => {
        try {
            if (!ObjectId.isValid(request.session?.userId)) return reply.code(401).send({ message: "Authentication required" });

            if (!validateVaultSettingsCrypto(request.body)) return reply.code(400).send({ message: "Invalid Vault Settings" })

            const userId = new ObjectId(request.session.userId);
            const { cryptoVersion, salt, wrapIv, wrappedVaultKey, kdf } = request.body;
            const now = new Date()

            const vaultSettings = {
                userId,
                cryptoVersion,
                salt: new Binary(Buffer.from(salt, "base64")),
                wrapIv: new Binary(Buffer.from(wrapIv, "base64")),
                wrappedVaultKey: new Binary(Buffer.from(wrappedVaultKey, "base64")),
                kdf,
                createdAt: now,
                updatedAt: now
            };

            await vaultSettingsCollection.insertOne(vaultSettings);

            return reply.code(201).send({
                message: "Vault initialised successfully"
            });
        } catch (error) {
            fastify.log.error(error)

            if (error.code === 11000) {
                return reply.code(409).send({
                    message: "Vault already initialised"
                });
            }
            return reply.code(500).send({ message: "An error occurred" })
        }
    })
}

module.exports = vaultSettingsRoutes