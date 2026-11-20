"use strict";

window.PasswordReuse = {
    findReused(entries) {
        const passwordGroups = new Map();
        const reusedEntryIds = new Set();

        for (const entry of entries) {
            if (
                entry.type !== "password" ||
                typeof entry.password !== "string" ||
                !entry.password
            ) {
                continue;
            }

            const existing = passwordGroups.get(entry.password) ?? [];

            existing.push(entry.entryId);
            passwordGroups.set(entry.password, existing);
        }

        for (const entryIds of passwordGroups.values()) {
            if (entryIds.length < 2) continue;

            for (const entryId of entryIds) {
                reusedEntryIds.add(entryId);
            }
        }

        // Remove references to plaintext passwords from this map.
        passwordGroups.clear();

        return reusedEntryIds;
    }
};