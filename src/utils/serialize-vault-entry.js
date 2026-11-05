function serializeVaultEntry(entry) {
    return {
        entryId: entry._id.toString(),
        cryptoVersion: entry.cryptoVersion,
        iv: entry.iv.value(true).toString('base64'),
        ciphertext: entry.ciphertext.value(true).toString('base64'),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
    };
}

module.exports = { serializeVaultEntry };