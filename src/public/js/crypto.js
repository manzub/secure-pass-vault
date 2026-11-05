function generateEntryId() {
    const randomBytes = crypto.getRandomValues(new Uint8Array(12));

    return Array.from(randomBytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

function generateAAD(entryId, cryptoVersion) {
    const aadString = `${entryId}:${cryptoVersion}`
    return new TextEncoder().encode(aadString)
}

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

async function encryptPayload(payload, key, entryId, cryptoVersion) {
    const iv = generateIV();
    const data = encodePayload(payload);
    const aad = generateAAD(entryId, cryptoVersion)

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: aad },
        key,
        data
    );

    return { iv, ciphertext };
}

async function decryptPayload(ciphertext, key, iv, entryId, cryptoVersion) {
    const aad = generateAAD(entryId, cryptoVersion)
    const arrayBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: aad },
        key,
        ciphertext
    );

    const textDecoder = new TextDecoder();

    return JSON.parse(textDecoder.decode(arrayBuffer));
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength

    const CHUNK_SIZE = 30000
    let binary = ''

    for (let i = 0; i < len; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE)
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary)
}

function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
}

const VaultCrypto = {
    generateAAD,
    generateEntryId,
    generateEncryptionKey,
    generateIV,
    encodePayload,
    encryptPayload,
    decryptPayload,
    arrayBufferToBase64,
    base64ToArrayBuffer
};

// Browser
if (typeof window !== "undefined") {
    window.VaultCrypto = VaultCrypto;
}

// Node.js testing
if (typeof module !== "undefined" && module.exports) {
    module.exports = VaultCrypto;
}