const path = require('node:path');
const Fastify = require('fastify');
const view = require('@fastify/view');
const nunjucks = require('nunjucks');

// routes
const landingRoutes = require('./routes/landing-routes');


function buildApp() {
    const fastify = Fastify({ logger: true });

    fastify.register(require('@fastify/static'), { root: path.join(__dirname, 'public'), prefix: '/public/' })
    fastify.register(view, { engine: { nunjucks }, root: path.join(__dirname, 'views') })
    fastify.register(landingRoutes)

    return fastify;
}

module.exports = buildApp