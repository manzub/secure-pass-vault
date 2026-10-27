const userSchema = {
    type: "object",
    required: ["email", "password"],
    properties: {
        email: {
            type: "string",
            format: "email",
            maxLength: 50
        },
        password: {
            type: "string",
            minLength: 12,
            maxLength: 128
        }
    },
    additionalProperties: false
}

module.exports = { userSchema }