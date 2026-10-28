async function createVaultEntriesIndex(vaultCollection) {
    return await vaultCollection.createIndex(
        { userId: 1 },
        { name: "userId_1" }
    );
}

async function createUsersEmailIndex(userCollection) {
    return await userCollection.createIndex(
        { email: 1 },
        { unique: true, name: "email_unique" }
    )
}

module.exports = { createVaultEntriesIndex, createUsersEmailIndex }