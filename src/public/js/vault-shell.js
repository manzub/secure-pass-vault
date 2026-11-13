(function () {
    "use strict";

    function showView(viewName) {
        const views = {
            unlock: document.getElementById("vaultUnlockView"),
            dashboard: document.getElementById("vaultDashboardView"),
            createNote: document.getElementById("vaultCreateNoteView")
        }

        for (const [name, element] of Object.entries(views)) {
            if (element) {
                element.hidden = name !== viewName;
            }
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const vaultShell = document.getElementById("vaultShell");

        vaultShell.addEventListener("click", (event) => {
            const button = event.target.closest("[data-view]");

            if (!button || !vaultShell.contains(button)) return;

            const viewName = button.dataset.view;

            const allowedViews = ["dashboard", "createNote"];

            if (!allowedViews.includes(viewName)) return;

            event.preventDefault();

            window.VaultShell.showView(viewName);
        });
    });

    window.VaultShell = {
        showView
    };
})();