const { MongoClient, ServerApiVersion } = require("mongodb");
const confSettings = require("./config");

const mongodbClient = new MongoClient(confSettings.mongodbUri, {
    serverApi: { 
        version: ServerApiVersion.v1,
        strict: true, 
        deprecationErrors: true
    }
})

module.exports = mongodbClient;