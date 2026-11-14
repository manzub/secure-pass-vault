(function () {
    "use strict";

    const channel = new BroadcastChannel("digital-vault-sync");

    channel.addEventListener("message", (event) => {
        if (event.data?.type === "VAULT_LOCKED") {
            window.dispatchEvent(new CustomEvent("vault:locked"));

            // Return to the unlock screen.
            window.VaultShell.showView("unlock");
            return;
        }

        if (event.data?.type === "ACCOUNT_LOGGED_OUT") {
            window.dispatchEvent(new CustomEvent("vault:locked"));
            window.location.replace("/login");
        }

    });

    window.VaultSync = {
        notifyLocked() {
            channel.postMessage({
                type: "VAULT_LOCKED"
            });
        },
        notifyLoggedOut() {
            channel.postMessage({
                type: "ACCOUNT_LOGGED_OUT"
            });
        }
    };
})();