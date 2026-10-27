const vaultEntrySchema = {
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

module.exports = { vaultEntrySchema };