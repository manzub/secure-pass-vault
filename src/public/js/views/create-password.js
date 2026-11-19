"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("createPasswordForm");
    const saveButton = document.getElementById("createPasswordSaveButton");
    const message = document.getElementById("createPasswordMessage");
    const passwordInput = document.getElementById("passwordValue");

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

            message.textContent = ""

        } catch (error) {
            message.textContent = error.message;
        }
    });

    if (!form) return;

    let saveGeneration = 0;

    document.addEventListener("vault:locked", () => {
        saveGeneration++;
        form.reset();
        message.textContent = "";
        saveButton.disabled = false;
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

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

            form.reset();
            message.textContent = "";

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