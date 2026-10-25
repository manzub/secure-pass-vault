const path = require('node:path');
const { loadEnvFile } = require('node:process');
const Fastify = require('fastify');
const view = require('@fastify/view');
const nunjucks = require('nunjucks');

function buildApp() {
    const app = Fastify({ logger: true });
    loadEnvFile('./atlas-credentials.env')

    app.register(view, { engine: { nunjucks }, root: path.join(__dirname, 'views') })

    app.get('/', async (request, reply) => {
        return reply.view('pages/home.njk', { title: process.env.MONGODB_USERNAME })
    })

    return app;
}

module.exports = buildApp