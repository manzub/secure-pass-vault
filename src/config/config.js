
const port = Number(process.env.PORT ?? 3000);
const nodeEnv = process.env.NODE_ENV ?? 'development';
const mongodbUri = process.env.MONGODB_URI;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
}

if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, production, or test');
}

if (!mongodbUri) {
    throw new Error('MONGODB_URI is required');
}

const confSettings = {
    port,
    nodeEnv,
    mongodbUri
};

module.exports = confSettings;
