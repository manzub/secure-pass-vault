const test = require("node:test");
const fastify = require("fastify");
const { userSchema } = require('../src/schemas/user-schema')

const app = fastify({})
app.post('/', { schema: { body: userSchema } }, async function (request, reply) {
    return reply.send({ message: "Route reached" })
})

test("Assert valid auth data", async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { email: 'aafegsgers@fsf.com', password: '1244533ds354efsd' }
    })

    assert.equal(response.statusCode, 200)
})

test("Assert invalid email data", async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { email: 'aafeg', password: '1244533ds354efsd' }
    })

    assert.equal(response.statusCode, 400)
})

test("Assert invalid password data", async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { email: 'aafegsgers@fsf.com', password: '12234' }
    })

    assert.equal(response.statusCode, 400)
})
