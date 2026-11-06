const requireAuth = require("../hooks/require-auth");

async function vaultPageRoutes(fastify, options) {
    fastify.get("/vault/setup",{ preHandler: requireAuth }, async function (request, reply) {
        return reply.view("pages/vault-setup.njk", {
            title: "Set Up Your Vault"
        });
    });

    fastify.get("/vault/unlock", { preHandler: requireAuth }, async function (request, reply) {
        return reply.view("pages/vault-unlock.njk", {
            title: "Unlock Your Vault"
        });
    });
}

module.exports = vaultPageRoutes;