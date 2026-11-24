"use strict";

window.VaultSecurity = {
    analyse(entries) {
        const passwords = entries.filter(entry =>
            entry.type === "password" &&
            typeof entry.password === "string" &&
            entry.password.length > 0
        );

        const reusedIds = PasswordReuse.findReused(passwords);

        const weakIds = new Set();
        const strongIds = new Set();

        for (const entry of passwords) {
            const { score } = PasswordStrength.analyse(entry.password);

            if (score <= 1) {
                weakIds.add(entry.entryId);
            }

            if (score >= 3) {
                strongIds.add(entry.entryId);
            }
        }

        return {
            totalPasswords: passwords.length,
            reusedCount: reusedIds.size,
            weakCount: weakIds.size,
            strongCount: strongIds.size,
            reusedIds,
            weakIds,
            strongIds
        };
    }
};