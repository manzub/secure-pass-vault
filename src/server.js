const buildApp = require("./app");

async function start(params) {
    const app = buildApp();

    app.listen({ port: 3000, host: '127.0.0.1' }, function (err, address) {
        if (err) {
            fastify.log.error(err)
            process.exit(1)
        }
        app.log.info(`server listening on ${address}`)
    })
}

start()