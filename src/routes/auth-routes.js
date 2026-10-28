const { loginSchema } = require("../schemas/login-schema");
const { userSchema } = require("../schemas/user-schema");
const normalizeEmail = require("../utils/normalize-email");
const { hashPassword, verifyPassword } = require("../utils/password");

async function authRoutes(fastify, options) {
    fastify.post("/api/register", { schema: { body: userSchema } }, async (request, reply) => {
        const email = normalizeEmail(request.body.email)
        const passwordHash = await hashPassword(request.body.password)
        const createdAt = new Date()
        const newUser = { email, passwordHash, createdAt, account_status: "pending_verification", updatedAt: createdAt }

        try {
            const resp = await options.usersCollection.insertOne(newUser)
            return reply.code(201).send({ message: "Registration successful", userId: resp.insertedId })
        } catch (error) {
            fastify.log.error(error)
            if (error.code === 11000) {
                return reply.code(409).send({ message: "Cannot use this email ID", userId: null })
            }
            return reply.code(500).send({ message: "An error occurred", userId: null })
        }
    })

    fastify.post("/api/login", { schema: { body: loginSchema } }, async (request, reply) => {
        try {
            const email = normalizeEmail(request.body.email)
            const user = await options.usersCollection.findOne({ email })

            if (!user) {
                return reply.code(401).send({ message: "Invalid email or password" });
            }

            if (!(await verifyPassword(user.passwordHash, request.body.password))) {
                return reply.code(401).send({ message: "Invalid email or password" });
            }

            // regenerate session ID
            await new Promise((resolve, reject) => {
                request.session.regenerate((error) => {
                    if (error) return reject(error);
                    resolve();
                })
            })
            // assign userId
            request.session.userId = user._id.toString()
            // save session
            await new Promise((resolve, reject) => {
                request.session.save((error) => {
                    if (error) return reject(error);
                    resolve();
                })
            })

            return reply.code(200).send({ message: "Login successful" })
        } catch (error) {
            fastify.log.error(error)
            return reply.code(500).send({ message: "An unexpected error occurred" })
        }
    })
}

module.exports = authRoutes