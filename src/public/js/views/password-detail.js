"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const name = document.getElementById("detailPasswordName");
    const username = document.getElementById("detailPasswordUsername");
    const password = document.getElementById("detailPasswordValue");
    const website = document.getElementById("detailPasswordWebsite");
    const notes = document.getElementById("detailPasswordNotes");
    const message = document.getElementById("detailPasswordMessage");

    const securitySection = document.getElementById("detailPasswordSecurity");
    const strengthLabel = document.getElementById("detailPasswordStrengthLabel");
    const strengthBars = document.getElementById("detailPasswordStrengthBars");
    const securityWarning = document.getElementById("detailPasswordSecurityWarning");
    const recommendations = document.getElementById("detailPasswordRecommendations");
    const suggestions = document.getElementById("detailPasswordSuggestions");

    if (!name || !password) return;

    let loadGeneration = 0;
    let currentEntryId = null;

    function clearPasswordSecurity() {
        securitySection.classList.add("hidden");

        strengthLabel.textContent = "";

        for (const bar of strengthBars.children) {
            bar.className = "h-2 rounded bg-gray-200";
        }

        securityWarning.textContent = "";
        securityWarning.classList.add("hidden");

        suggestions.replaceChildren();
        recommendations.classList.add("hidden");
    }

    function clearPasswordDetails() {
        currentEntryId = null;

        name.textContent = "";
        username.textContent = "";
        password.value = "";
        password.type = "password";
        website.textContent = "";
        notes.textContent = "";
        message.textContent = "";

        document.getElementById("detailPasswordToggle").textContent = "Show";

        clearPasswordSecurity()
    }

    function renderPasswordSecurity(passwordValue) {
        clearPasswordSecurity();

        const result = PasswordStrength.analyse(passwordValue);

        if (!result) return;

        const labels = [
            "Very weak",
            "Weak",
            "Fair",
            "Strong",
            "Very strong"
        ];

        const colours = [
            "bg-red-600",
            "bg-red-500",
            "bg-amber-500",
            "bg-green-500",
            "bg-green-600"
        ];

        strengthLabel.textContent = labels[result.score];

        const filledBars = Math.max(1, result.score);

        Array.from(strengthBars.children).forEach((bar, index) => {
            bar.className = `h-2 rounded ${index < filledBars
                ? colours[result.score]
                : "bg-gray-200"
                }`;
        });

        if (result.warning) {
            securityWarning.textContent = result.warning;
            securityWarning.classList.remove("hidden");
        }

        for (const suggestion of result.suggestions) {
            const item = document.createElement("li");

            item.textContent = suggestion;

            suggestions.appendChild(item);
        }

        recommendations.classList.toggle(
            "hidden",
            result.suggestions.length === 0
        );

        securitySection.classList.remove("hidden");
    }

    window.addEventListener("vault:password-selected", async (event) => {
        const generation = ++loadGeneration;
        const entryId = event.detail?.entryId;

        clearPasswordDetails();

        if (!entryId) return;

        currentEntryId = entryId;
        message.textContent = "Loading password...";

        VaultShell.showView("passwordDetail");

        try {
            const entry = await VaultEntryClient.getEntry(entryId);

            if (generation !== loadGeneration) return;

            const payload = await VaultEntryClient.decryptEntry(entry);

            if (generation !== loadGeneration) return;

            if (payload.type !== "password") {
                throw new Error("Invalid password entry");
            }

            name.textContent = payload.name ?? "";
            username.textContent = payload.username ?? "";
            password.value = payload.password ?? "";
            website.textContent = payload.website ?? "";
            notes.textContent = payload.notes ?? "";

            renderPasswordSecurity(password.value)

            message.textContent = "";

        } catch (error) {
            if (generation !== loadGeneration) return;

            clearPasswordDetails();
            message.textContent = "Unable to load password.";
        }
    });

    window.addEventListener("vault:locked", () => {
        loadGeneration++;
        clearPasswordDetails();
    });

    window.addEventListener("vault:view-leaving", (event) => {
        if (event.detail?.from !== "passwordDetail") return;

        loadGeneration++;
        clearPasswordDetails();
    });

    const toggleButton = document.getElementById("detailPasswordToggle");
    toggleButton.addEventListener("click", () => {
        const isHidden = password.type === "password";

        password.type = isHidden ? "text" : "password";
        toggleButton.textContent = isHidden ? "Hide" : "Show";
    });

    const editButton = document.getElementById("detailPasswordEditButton");
    editButton.addEventListener("click", () => {
        if (!currentEntryId) return;

        window.dispatchEvent(
            new CustomEvent("vault:password-edit", {
                detail: { entryId: currentEntryId }
            })
        );
    });

    const deleteButton = document.getElementById("detailPasswordDeleteButton");
    let deleteInProgress = false;
    deleteButton.addEventListener("click", async () => {
        if (!currentEntryId || deleteInProgress) return;

        const entryId = currentEntryId;
        const generation = loadGeneration;

        const confirmed = window.confirm(
            "Are you sure you want to delete this password? This action cannot be undone."
        );

        if (!confirmed) return;

        deleteInProgress = true;
        deleteButton.disabled = true;
        message.textContent = "Deleting password...";

        try {
            await VaultEntryClient.deleteEntry(entryId);

            if (generation !== loadGeneration) return;

            loadGeneration++;
            clearPasswordDetails();

            window.dispatchEvent(
                new CustomEvent("vault:entries-changed")
            );

            VaultShell.showView("dashboard");

        } catch (error) {
            if (generation !== loadGeneration) return;

            console.error("Unable to delete password:", error);
            message.textContent = "Unable to delete password.";

        } finally {
            deleteInProgress = false;
            deleteButton.disabled = false;
        }
    });

    const copyButton = document.getElementById("detailPasswordCopy");
    copyButton.addEventListener("click", async () => {
        if (!password.value || !currentEntryId) return;

        const generation = loadGeneration;

        try {
            await navigator.clipboard.writeText(password.value);

            if (generation !== loadGeneration) return;

            message.textContent = "Password copied to clipboard.";
        } catch (error) {
            if (generation !== loadGeneration) return;

            console.error("Unable to copy password:", error);
            message.textContent = "Unable to copy password.";
        }
    });

    const copyUsernameButton = document.getElementById("detailUsernameCopy");
    copyUsernameButton.addEventListener("click", async () => {
        if (!username.textContent || !currentEntryId) return;

        const generation = loadGeneration;

        try {
            await navigator.clipboard.writeText(username.textContent);

            if (generation !== loadGeneration) return;

            message.textContent = "Username copied to clipboard.";
        } catch (error) {
            if (generation !== loadGeneration) return;

            console.error("Unable to copy username:", error);
            message.textContent = "Unable to copy username.";
        }
    });
});