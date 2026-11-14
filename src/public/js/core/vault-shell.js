(function () {
    "use strict";

    function showView(viewName) {
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