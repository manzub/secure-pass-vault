(function () {
    "use strict";

    let sessionExpired = false;

    function expireSession() {
        if (sessionExpired) return;

        sessionExpired = true;

        window.dispatchEvent(
            new CustomEvent("auth:session-expired")
        );
    }

    async function authFetch(url, options = {}) {
        if (sessionExpired) {
            throw new Error("Session expired. Please log in again.");
        }

        const response = await fetch(url, options);

        if (response.status === 401) {
            expireSession();
            throw new Error("Session expired. Please log in again.");
        }

        if (sessionExpired) {
            throw new Error("Session expired. Please log in again.");
        }

        return response;
    }

    window.AuthFetch = authFetch;
})();