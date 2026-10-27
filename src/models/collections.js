
const mongodbClient = require("../config/database");

function getCollections() {
    const database = mongodbClient.db("secure-vault");

    const usersCollection = database.collection("users");
    const vaultEntriesCollection = database.collection("vaultEntries");

    return {
        usersCollection,
        vaultEntriesCollection
    };
}

module.exports = getCollections;
