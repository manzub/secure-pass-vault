(function () {
    "use strict";

    let sessionExpiryHandled = false;

    function showView(viewName) {
        if (sessionExpiryHandled) return;

        const views = {
            unlock: document.getElementById("vaultUnlockView"),
            dashboard: document.getElementById("vaultDashboardView"),
            createNote: document.getElementById("vaultCreateNoteView"),
            noteDetail: document.getElementById("vaultNoteDetailView"),
            editNote: document.getElementById("vaultEditNoteView")
        }

        for (const [name, element] of Object.entries(views)) {
            if (element) {
                element.hidden = name !== viewName;
            }
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        let sessionCheckInProgress = false;

        document.addEventListener("visibilitychange", async () => {
            if (document.visibilityState !== "visible") return;
            if (sessionCheckInProgress) return;

            sessionCheckInProgress = true;

            try {
                const response = await fetch("/api/auth/session", {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store"
                });

                if (response.status === 401) {
                    window.dispatchEvent(
                        new CustomEvent("auth:session-expired")
                    );
                    return;
                }

                if (!response.ok) {
                    throw new Error("Unable to validate session");
                }

            } catch (error) {
                console.error("Session revalidation failed:", error);

                window.dispatchEvent(new CustomEvent("vault:locked"));

                // Lock the shared encryption key.
                try {
                    const result = await window.VaultWorkerClient.send("LOCK");

                    if (result.type !== "LOCK_RESULT" || result.unlocked !== false) {
                        throw new Error("Unable to confirm vault lock");
                    }

                    window.VaultSync.notifyLocked();
                } catch (lockError) {
                    console.error("Unable to confirm vault lock:", lockError);
                }

                window.VaultShell.showView("unlock");
            } finally {
                sessionCheckInProgress = false;
            }
        });

        window.addEventListener("auth:session-expired", async () => {
            if (sessionExpiryHandled) return;

            sessionExpiryHandled = true;

            // clear decrypted content from every view.
            window.dispatchEvent(new CustomEvent("vault:locked"));

            // Hide the vault interface.
            // window.VaultShell.showView("unlock");

            try {
                // Discard the encryption key held by the SharedWorker.
                await window.VaultWorkerClient.send("LOCK");
            } catch (error) {
                console.error("Unable to confirm SharedWorker lock:", error);
            } finally {
                window.location.replace("/login");
            }
        });

        window.addEventListener("vault:note-selected", () => {
            window.VaultShell.showView("noteDetail");
        });

        window.addEventListener("vault:note-edit", () => {
            window.VaultShell.showView("editNote");
        });

        const vaultShell = document.getElementById("vaultShell");

        vaultShell.addEventListener("click", (event) => {
            const button = event.target.closest("[data-view]");

            if (!button || !vaultShell.contains(button)) return;

            const viewName = button.dataset.view;

            const allowedViews = ["dashboard", "createNote", "noteDetail"];

            if (!allowedViews.includes(viewName)) return;

            event.preventDefault();

            window.VaultShell.showView(viewName);
        });
    });

    window.VaultShell = {
        showView
    };
})();