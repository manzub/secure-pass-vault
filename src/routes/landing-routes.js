async function landingRoutes (fastify, options) {
    fastify.get('/', async (request, reply) => {
        return reply.view('pages/home.njk', { title: 'Home' })
    })

    fastify.get('/about', async (request, reply) => {
        return reply.view('pages/about.njk', { title: 'About Page', description: 'About page contents' })
    })
}

module.exports = landingRoutes;