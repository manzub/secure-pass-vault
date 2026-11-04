async function generateEncryptionKey() {
    return crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

function generateIV() {
    const array = new Uint8Array(12);
    return crypto.getRandomValues(array);
}

function encodePayload(payload) {
    const textEncoder = new TextEncoder()
    return textEncoder.encode(JSON.stringify(payload))
}

async function encryptPayload(payload, key, additionalData) {
    const iv = generateIV();
    const data = encodePayload(payload);

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData },
        key,
        data
    );

    return { iv, ciphertext };
}

async function decryptPayload(ciphertext, key, iv, additionalData) {
    const arrayBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData },
        key,
        ciphertext
    );

    const textDecoder = new TextDecoder();

    return JSON.parse(textDecoder.decode(arrayBuffer));
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    let bytes = new Uint8Array(buffer)
    let len = bytes.byteLength
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
}

module.exports = { generateEncryptionKey, generateIV, encodePayload, decryptPayload, encryptPayload, arrayBufferToBase64 }