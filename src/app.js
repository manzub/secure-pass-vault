const path = require('node:path');
const Fastify = require('fastify');
const view = require('@fastify/view');
const nunjucks = require('nunjucks');

// routes
const landingRoutes = require('./routes/landing-routes');
const vaultEntryRoutes = require('./routes/vault-entry-routes');
const authRoutes = require('./routes/auth-routes');
const vaultSettingsRoutes = require('./routes/vault-settings-routes');
const vaultPageRoutes = require('./routes/vault-page-routes');


function buildApp(collections, settings) {
    const fastify = Fastify({ logger: true, bodyLimit: 100 * 1024 });

    fastify.register(require('@fastify/cookie'))
    fastify.register(require('@fastify/session'), {
        secret: settings.sessionSecret,
        cookieName: 'vault.sid',
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: !settings.isDevelopment,
            maxAge: 30 * 60 * 1000
        }
    })
    fastify.register(require('@fastify/static'), { root: path.join(__dirname, 'public'), prefix: '/public/' })
    fastify.register(view, { engine: { nunjucks }, root: path.join(__dirname, 'views') })
    fastify.register(landingRoutes)
    fastify.register(authRoutes, { usersCollection: collections.usersCollection })
    fastify.register(vaultEntryRoutes, { vaultEntriesCollection: collections.vaultEntriesCollection })
    fastify.register(vaultSettingsRoutes, { vaultSettingsCollection: collections.vaultSettingsCollection })
    fastify.register(vaultPageRoutes)

    return fastify;
}

module.exports = buildApp