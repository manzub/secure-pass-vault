"use strict";

window.PasswordStrength = {
    attach(passwordInput, container, label) {
        const segments = container.querySelectorAll(
            ".password-strength-segment"
        );

        const labels = [
            "Very weak",
            "Weak",
            "Fair",
            "Strong",
            "Very strong"
        ];

        const colours = [
            "bg-red-500",
            "bg-orange-500",
            "bg-yellow-500",
            "bg-green-400",
            "bg-green-600"
        ];

        function update() {
            const password = passwordInput.value;

            segments.forEach(segment => {
                segment.classList.remove(
                    "bg-gray-200",
                    ...colours
                );

                segment.classList.add("bg-gray-200");
            });

            if (!password) {
                label.textContent =
                    "Enter a password to check its strength.";
                return;
            }

            const score = zxcvbn(password).score;

            label.textContent = labels[score];

            const filledSegments = Math.max(1, score);

            segments.forEach((segment, index) => {
                if (index < filledSegments) {
                    segment.classList.remove("bg-gray-200");
                    segment.classList.add(colours[score]);
                }
            });
        }

        passwordInput.addEventListener("input", update);

        update();

        return { update };
    }
};