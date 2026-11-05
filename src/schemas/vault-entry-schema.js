const createVaultEntrySchema = {
    type: "object",
    required: ["entryId", "cryptoVersion", "iv", "ciphertext"],
    properties: {
        entryId: {
            type: "string",
            pattern: "^[0-9a-fA-F]{24}$"
        },
        cryptoVersion: {
            type: "integer",
            const: 1
        },
        iv: {
            type: "string",
            minLength: 1,
            maxLength: 16
        },
        ciphertext: {
            type: "string",
            minLength: 1,
            maxLength: 100000
        }
    },
    additionalProperties: false
};

const updateVaultEntrySchema = {
    type: "object",
    required: ["cryptoVersion", "iv", "ciphertext"],
    properties: {
        cryptoVersion: {
            type: "integer",
            const: 1
        },
        iv: {
            type: "string",
            minLength: 1,
            maxLength: 16
        },
        ciphertext: {
            type: "string",
            minLength: 1,
            maxLength: 100000
        }
    },
    additionalProperties: false
};

module.exports = { createVaultEntrySchema, updateVaultEntrySchema };