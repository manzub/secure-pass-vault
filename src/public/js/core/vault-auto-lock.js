(function () {
    "use strict";

    const ACTIVITY_REPORT_INTERVAL = 1000;

    let vaultUnlocked = false;
    let lastActivityReport = 0;
    let reportingGeneration = null;
    let activityGeneration = 0;

    async function reportActivity() {
        if (!vaultUnlocked) return;

        const now = Date.now();
        const generation = activityGeneration;

        if (reportingGeneration === generation) return;

        if (now - lastActivityReport < ACTIVITY_REPORT_INTERVAL) {
            return;
        }

        reportingGeneration = generation;
        lastActivityReport = now;

        try {
            const result = await window.VaultWorkerClient.send("ACTIVITY");

            if (!vaultUnlocked || generation !== activityGeneration) {
                return;
            }

            if (
                result.type !== "ACTIVITY_RESULT" ||
                result.unlocked !== true
            ) {
                window.dispatchEvent(new CustomEvent("vault:locked"));
                window.VaultShell.showView("unlock");
            }
        } catch (error) {
            if (generation === activityGeneration) {
                console.error("Unable to report vault activity:", error);
            }
        } finally {
            if (reportingGeneration === generation) {
                reportingGeneration = null;
            }
        }
    }

    function handleActivity() {
        void reportActivity();
    }

    ["pointerdown", "keydown", "touchstart"].forEach(eventName => {
        document.addEventListener(eventName, handleActivity, {
            passive: true
        });
    });

    window.addEventListener("vault:unlocked", () => {
        activityGeneration++;
        vaultUnlocked = true;
        lastActivityReport = 0;

        void reportActivity();
    });

    window.addEventListener("vault:locked", () => {
        activityGeneration++;
        vaultUnlocked = false;
        lastActivityReport = 0;
    });

    window.VaultAutoLock = {
        reportActivity
    };
})();