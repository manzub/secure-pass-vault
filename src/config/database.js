const { MongoClient, ServerApiVersion } = require("mongodb");
const confSettings = require("./config");

const mongodbClient = new MongoClient(confSettings.mongodbUri, {
    maxPoolSize: 150,

    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
})

module.exports = mongodbClient;