function serializeVaultSettings(settings) {
    return {
        cryptoVersion: settings.cryptoVersion,
        salt: settings.salt.value(true).toString("base64"),
        wrapIv: settings.wrapIv.value(true).toString("base64"),
        wrappedVaultKey: settings.wrappedVaultKey.value(true).toString("base64"),
        kdf: settings.kdf
    };
}

module.exports = { serializeVaultSettings }