async function requireAuth(request, reply) {
    if (request.session?.userId) {
        return;
    }

    // API requests receive a JSON error
    if (request.url.startsWith("/api/")) {
        return reply.code(401).send({
            error: "Unauthorized",
            message: "Your session has expired. Please log in again."
        });
    }

    // Browser page requests redirect to login
    return reply.redirect("/login");
}

module.exports = requireAuth;