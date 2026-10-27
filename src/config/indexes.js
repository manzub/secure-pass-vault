async function createVaultEntriesIndex(collection) {
    return await collection.createIndex(
        { userId: 1 },
        { name: "userId_1" }
    );
}

module.exports = createVaultEntriesIndex