(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const form = document.getElementById("loginForm");
        if (!form) return;

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const loginButton = document.getElementById("loginButton");
        const loginMessage = document.getElementById("loginMessage");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            loginMessage.textContent = "";
            loginButton.disabled = true;

            try {
                const response = await fetch("/api/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({ email, password })
                });

                if (!response.ok) {
                    loginMessage.textContent =
                        response.status === 401
                            ? "Invalid email or password"
                            : "Unable to log in. Please try again.";
                    return;
                }

                passwordInput.value = "";

                window.location.assign("/vault/setup");

            } catch (error) {
                loginMessage.textContent =
                    "Connection error. Please try again.";
            } finally {
                loginButton.disabled = false;
            }
        });
    });
})();