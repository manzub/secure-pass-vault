const { loadEnvFile } = require('node:process');

loadEnvFile('./conf.env');

const confSettings = require('./config/config');
const buildApp = require('./app');
const mongodbClient = require('./config/database');
const getCollections = require('./models/collections');
const { createVaultEntriesIndex, createUsersEmailIndex } = require('./config/indexes');

async function start() {
    let app;

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
        
        // build fastify app and get collections
        const collections = getCollections()
        app = buildApp(collections)
        
        app.log.info({
            usersCollectionAvailable: Boolean(collections.usersCollection),
            vaultEntriesCollectionAvailable: Boolean(collections.vaultEntriesCollection)
        });
        await createVaultEntriesIndex(collections.vaultEntriesCollection)
        await createUsersEmailIndex(collections.usersCollection)
        app.log.info('MongoDB connection verified');
        app.log.info('verified vaultEntries index && usersEmail index');

        const address = await app.listen({
            port: confSettings.port,
            host: '127.0.0.1'
        });

        isListening = true;
        app.log.info(`Server listening on ${address}`);
    } catch (error) {
        console.error('Application startup failed', error)
        process.exitCode = 1;

        await shutdown();
    }
}

start();
