(function () {
    "use strict";

    async function createEntry(payload) {
        const entryId = crypto.randomUUID()
            .replaceAll("-", "")
            .slice(0, 24);

        const encrypted = await window.VaultWorkerClient.send("ENCRYPT_ENTRY", {
            entryId,
            cryptoVersion: 1,
            payload
        });

        if (!encrypted.success || !encrypted.entry) {
            throw new Error(encrypted.message || "Unable to encrypt entry");
        }

        const response = await fetch("/api/vault-entries", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(encrypted.entry)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Unable to save entry");
        }

        return result;
    }

    async function getEntries() {
        const response = await fetch("/api/vault-entries", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Unable to retrieve vault entries");
        }

        return response.json();
    }

    async function decryptEntry(entry) {
        const result = await window.VaultWorkerClient.send("DECRYPT_ENTRY", {
            entry
        });

        if (!result.success) {
            throw new Error(result.message || "Unable to decrypt entry");
        }

        return {
            entryId: entry.entryId,
            ...result.payload
        };
    }

    window.VaultEntryClient = {
        createEntry,
        getEntries,
        decryptEntry
    };
})();