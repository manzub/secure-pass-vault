const { ObjectId } = require("mongodb");
const requireAuth = require("../hooks/require-auth");

async function vaultPageRoutes(fastify, options) {
    const { vaultSettingsCollection } = options

    fastify.get("/vault", { preHandler: requireAuth }, async function (request, reply) {
        return reply.view("pages/vault-dashboard.njk", {
            title: "My Vault"
        });
    });

    fastify.get("/vault/notes/new", { preHandler: requireAuth }, async function (request, reply) {
        return reply.view("pages/vault-create-note.njk", {
            title: "Create Note"
        });
    });

    fastify.get("/vault/setup", { preHandler: requireAuth }, async function (request, reply) {
        const userId = new ObjectId(request.session.userId)

        const existingSettings = await vaultSettingsCollection.findOne({ userId })

        if (existingSettings) {
            return reply.redirect('/vault/unlock')
        }

        return reply.view("pages/vault-setup.njk", {
            title: "Set Up Your Vault"
        });
    });

    fastify.get("/vault/unlock", { preHandler: requireAuth }, async function (request, reply) {
        return reply.redirect("/vault");
    });

    fastify.get("/vault/notes/:entryId", { preHandler: requireAuth }, async function (request, reply) {
        return reply.view("pages/vault-note-detail.njk", {
            title: "View Note",
            entryId: request.params.entryId
        });
    });

    fastify.get("/vault/notes/:entryId/edit", { preHandler: requireAuth }, async function (request, reply) {
        return reply.view("pages/vault-edit-note.njk", {
            title: "Edit Note"
        });
    });
}

module.exports = vaultPageRoutes;