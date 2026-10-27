const { Buffer } = require("node:buffer");

function isValidBase64(value) {
    if (typeof value !== "string") return false;

    if (value.length === 0 || value.trim() === "") return false;

    const buf = Buffer.from(value, "base64")
    let recoded = buf.toString('base64')

    return value === recoded;
}

function validateVaultEntryCrypto(params) { // { iv, ciphertext }
    if (!params || typeof params !== "object") return false;
    
    if (!isValidBase64(params.iv) || !isValidBase64(params.ciphertext)) return false

    const buf = Buffer.from(params.iv, "base64")
    if (buf.length !== 12) return false

    const cipherTextBuffer = Buffer.from(params.ciphertext, "base64")
    if (cipherTextBuffer.length === 0) return false;

    return true
}

module.exports = { isValidBase64, validateVaultEntryCrypto }