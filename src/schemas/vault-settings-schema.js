const createVaultSettingsSchema = {
    type: "object",
    required: ["cryptoVersion", "salt", "wrapIv", "wrappedVaultKey", "kdf"],
    properties: {
        cryptoVersion: {
            type: "integer",
            const: 1
        },
        salt: {
            type: "string",
            minLength: 24,
            maxLength: 24
        },
        wrapIv: {
            type: "string",
            minLength: 16,
            maxLength: 16
        },
        wrappedVaultKey: {
            type: "string",
            minLength: 64,
            maxLength: 64
        },
        kdf: {
            type: "object",
            required: ["algorithm", "iterations", "parallelism", "memorySize", "hashLength"],
            properties: {
                algorithm: {
                    type: "string",
                    const: "argon2id"
                },
                iterations: {
                    type: "integer",
                    const: 3
                },
                parallelism: {
                    type: "integer",
                    const: 1
                },
                memorySize: {
                    type: "integer",
                    const: 65536
                },
                hashLength: {
                    type: "integer",
                    const: 32
                },
            },
            additionalProperties: false
        }
    },
    additionalProperties: false
}

module.exports = { createVaultSettingsSchema };