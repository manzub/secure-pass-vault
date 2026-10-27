const path = require('node:path');
const Fastify = require('fastify');
const view = require('@fastify/view');
const nunjucks = require('nunjucks');

// routes
const landingRoutes = require('./routes/landing-routes');
const vaultEntryRoutes = require('./routes/vault-entry-routes');


function buildApp() {
    const fastify = Fastify({ logger: true, bodyLimit: 100 * 1024 });

    fastify.register(require('@fastify/static'), { root: path.join(__dirname, 'public'), prefix: '/public/' })
    fastify.register(view, { engine: { nunjucks }, root: path.join(__dirname, 'views') })
    fastify.register(landingRoutes)
    fastify.register(vaultEntryRoutes)

    return fastify;
}

module.exports = buildApp