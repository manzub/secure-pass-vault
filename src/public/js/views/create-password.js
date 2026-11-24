"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("createPasswordForm");
    const saveButton = document.getElementById("createPasswordSaveButton");
    const message = document.getElementById("createPasswordMessage");
    const passwordInput = document.getElementById("passwordValue");

    const passwordStrength = PasswordStrength.attach(
        passwordInput,
        document.getElementById("passwordStrengthContainer"),
        document.getElementById("passwordStrengthLabel")
    );

    // password generator options
    const generatorLength = document.getElementById("generatorLength");
    const generatorLowercase = document.getElementById("generatorLowercase");
    const generatorUppercase = document.getElementById("generatorUppercase");
    const generatorNumbers = document.getElementById("generatorNumbers");
    const generatorSymbols = document.getElementById("generatorSymbols");

    const generateButton = document.getElementById("generatePasswordButton");
    generateButton.addEventListener("click", () => {
        try {
            const generatedPassword = PasswordGenerator.generate({
                length: Number(generatorLength.value),
                lowercase: generatorLowercase.checked,
                uppercase: generatorUppercase.checked,
                numbers: generatorNumbers.checked,
                symbols: generatorSymbols.checked
            });

            passwordInput.value = generatedPassword;
            passwordInput.type = "password";

            passwordStrength.update();

            message.textContent = ""

        } catch (error) {
            message.textContent = error.message;
        }
    });

    if (!form) return;

    let saveGeneration = 0;

    function resetCreateView() {
        saveGeneration++;

        form.reset();

        passwordInput.value = "";
        passwordInput.type = "password";

        passwordStrength.update();

        message.textContent = "";
        saveButton.disabled = false;
    }


    // event listeners
    window.addEventListener("vault:locked", () => {
        resetCreateView()
    });

    window.addEventListener("vault:view-leaving", (event) => {
        if (event.detail?.from !== "createPassword") return;

        resetCreateView();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (saveButton.disabled) return;

        const generation = ++saveGeneration;

        const payload = {
            type: "password",
            name: document.getElementById("passwordName").value.trim(),
            username: document.getElementById("passwordUsername").value.trim(),
            password: passwordInput.value,
            website: document.getElementById("passwordWebsite").value.trim(),
            notes: document.getElementById("passwordNotes").value.trim()
        };

        if (!payload.name || !payload.password) {
            message.textContent = "Name and password are required.";
            return;
        }

        saveButton.disabled = true;
        message.textContent = "Saving password...";

        try {
            await VaultEntryClient.createEntry(payload);

            if (generation !== saveGeneration) return;

            window.dispatchEvent(
                new CustomEvent("vault:entries-changed")
            );

            VaultShell.showView("dashboard");

        } catch (error) {
            console.error("Password creation failed:", error);

            if (generation !== saveGeneration) return;

            message.textContent = "Unable to save password.";

        } finally {
            if (generation === saveGeneration) {
                saveButton.disabled = false;
            }
        }
    });
});