const { loadEnvFile } = require('node:process');
loadEnvFile('./conf.env')

const confSettings = require('./config/config');
const buildApp = require("./app");

async function start() {
    const app = buildApp();

    try {
        const address = await app.listen({ port: confSettings.port, host: '127.0.0.1' })
        app.log.info(`Server listening on ${address}`);
    } catch (error) {
        app.log.error(error)
        process.exit(1)
    }
}

start()