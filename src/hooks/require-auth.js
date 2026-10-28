async function requireAuth(request, reply) {
    if (!request.session.userId) {
        return reply.code(401).send({
            message: "Authentication required"
        });
    }
}

module.exports = requireAuth;