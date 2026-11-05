function isValidBase64(value, expectedBytes) {
    if (typeof value !== "string") return false;

    const decoded = Buffer.from(value, "base64");

    return (
        decoded.length === expectedBytes &&
        decoded.toString("base64") === value
    );
}

function validateVaultSettingsCrypto(settings) {
    return (
        isValidBase64(settings.salt, 16) &&
        isValidBase64(settings.wrapIv, 12) &&
        isValidBase64(settings.wrappedVaultKey, 48)
    );
}

module.exports = { validateVaultSettingsCrypto };