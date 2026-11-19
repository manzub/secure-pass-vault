"use strict";

const PasswordGenerator = (() => {
    const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
    const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const NUMBERS = "0123456789";
    const SYMBOLS = "!@#$%^&*()-_=+[]{}";

    function randomIndex(max) {
        if (!Number.isSafeInteger(max) || max <= 0 || max > 0x100000000) {
            throw new Error("Invalid random range");
        }

        const range = 0x100000000;
        const limit = range - (range % max);
        const values = new Uint32Array(1);

        let value;

        do {
            crypto.getRandomValues(values);
            value = values[0];
        } while (value >= limit);

        return value % max;
    }

    function generate(options = {}) {
        const {
            length = 20,
            lowercase = true,
            uppercase = true,
            numbers = true,
            symbols = true
        } = options;

        if (!Number.isInteger(length) || length < 8 || length > 128) {
            throw new Error("Password length must be between 8 and 128");
        }

        const selected = [];

        if (lowercase) selected.push(LOWERCASE);
        if (uppercase) selected.push(UPPERCASE);
        if (numbers) selected.push(NUMBERS);
        if (symbols) selected.push(SYMBOLS);

        if (selected.length === 0) {
            throw new Error("Select at least one character type");
        }

        if (length < selected.length) {
            throw new Error("Password is too short for selected character types");
        }

        const characters = selected.join("");
        const result = [];

        // Guarantee at least one character from each selected group.
        for (const group of selected) {
            result.push(group[randomIndex(group.length)]);
        }

        // Fill the remaining positions.
        while (result.length < length) {
            result.push(characters[randomIndex(characters.length)]);
        }

        // Secure Fisher-Yates shuffle.
        for (let i = result.length - 1; i > 0; i--) {
            const j = randomIndex(i + 1);

            [result[i], result[j]] = [result[j], result[i]];
        }

        return result.join("");
    }

    return { generate };
})();