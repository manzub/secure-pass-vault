const { loadEnvFile } = require('node:process');

loadEnvFile('./conf.env');

const confSettings = require('./config/config');
const buildApp = require('./app');
const mongodbClient = require('./config/database');

async function start() {
    const app = buildApp();

    let isShuttingDown = false;
    let isMongoConnected = false;
    let isListening = false;

    async function shutdown() {
        if (isShuttingDown) return;

        isShuttingDown = true;

        try {
            if (isListening) {
                await app.close();
                isListening = false;
            }

            if (isMongoConnected) {
                await mongodbClient.close();
                isMongoConnected = false;
            }

            app.log.info('Fastify and MongoDB shut down successfully');
        } catch (error) {
            app.log.error(error, 'Error during shutdown');
            process.exitCode = 1;
        }
    }

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        await mongodbClient.connect();
        isMongoConnected = true;

        const db = mongodbClient.db();
        await db.command({ ping: 1 });

        app.log.info('MongoDB connection verified');

        const address = await app.listen({
            port: confSettings.port,
            host: '127.0.0.1'
        });

        isListening = true;
        app.log.info(`Server listening on ${address}`);
    } catch (error) {
        app.log.error(error, 'Application startup failed');
        process.exitCode = 1;

        await shutdown();
    }
}

start();
