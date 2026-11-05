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

async function createVaultSettingsIndex(vaultSettingsCollection) {
    return await vaultSettingsCollection.createIndex(
        { userId: 1 },
        { unique: true }
    )
}

module.exports = { createVaultEntriesIndex, createUsersEmailIndex, createVaultSettingsIndex }