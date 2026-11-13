
(function () {
    "use strict";

    let worker = null;
    let nextRequestId = 0;

    const pendingRequests = new Map();

    function connect() {
        if (worker) return worker;

        worker = new SharedWorker(
            "/public/js/vault-worker.js",
            { name: "digital-vault" }
        );

        worker.port.onmessage = function (event) {
            const response = event.data ?? {};

            const pending = pendingRequests.get(response.requestId);
            if (!pending) return;

            clearTimeout(pending.timeout);
            pendingRequests.delete(response.requestId);

            pending.resolve(response);
        };

        worker.port.start();

        return worker;
    }

    function send(type, data = {}) {
        connect();

        return new Promise((resolve, reject) => {
            const requestId = ++nextRequestId;

            const timeout = setTimeout(() => {
                pendingRequests.delete(requestId);
                reject(new Error("Worker request timed out"));
            }, 30000);

            pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout
            });

            try {
                worker.port.postMessage({
                    ...data,
                    type,
                    requestId
                });
            } catch (error) {
                clearTimeout(timeout);
                pendingRequests.delete(requestId);
                reject(error);
            }
        });
    }

    window.VaultWorkerClient = {
        connect,
        send
    };
})();
