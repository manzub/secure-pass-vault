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

        const response = await window.AuthFetch("/api/vault-entries", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(encrypted.entry)
        });

        handleUnauthorized(response)

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Unable to save entry");
        }

        return result;
    }

    async function getEntries() {
        const response = await window.AuthFetch("/api/vault-entries", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });

        handleUnauthorized(response)

        if (!response.ok) {
            throw new Error("Unable to retrieve vault entries");
        }

        return response.json();
    }

    async function getEntry(entryId) {
        if (!/^[a-fA-F0-9]{24}$/.test(entryId)) {
            throw new Error("Invalid entry ID");
        }

        const response = await window.AuthFetch(
            `/api/vault-entries/${encodeURIComponent(entryId)}`,
            {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store"
            }
        );

        handleUnauthorized(response)

        if (response.status === 404) {
            throw new Error("Entry not found");
        }

        if (!response.ok) {
            throw new Error("Unable to retrieve entry");
        }

        return response.json();
    }

    async function updateEntry(entryId, payload) {
        if (!/^[a-fA-F0-9]{24}$/.test(entryId)) {
            throw new Error("Invalid entry ID");
        }

        const encrypted = await window.VaultWorkerClient.send("ENCRYPT_ENTRY", {
            entryId,
            cryptoVersion: 1,
            payload
        });

        if (!encrypted.success || !encrypted.entry) {
            throw new Error(encrypted.message || "Unable to encrypt entry");
        }

        const { cryptoVersion, iv, ciphertext } = encrypted.entry;

        const response = await window.AuthFetch(
            `/api/vault-entries/${encodeURIComponent(entryId)}`,
            {
                method: "PUT",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    cryptoVersion,
                    iv,
                    ciphertext
                })
            }
        );

        handleUnauthorized(response)

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Unable to update entry");
        }

        return result;
    }

    async function deleteEntry(entryId) {
        if (!/^[a-fA-F0-9]{24}$/.test(entryId)) {
            throw new Error("Invalid entry ID");
        }

        const response = await fetch(
            `/api/vault-entries/${encodeURIComponent(entryId)}`,
            {
                method: "DELETE",
                credentials: "same-origin"
            }
        );

        handleUnauthorized(response)

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("Entry not found");
            }

            throw new Error("Unable to delete entry");
        }

        return true;
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

    function handleUnauthorized(response) {
        if (response.status === 401) {
            window.location.replace("/login");
            throw new Error("Session expired");
        }
    }

    window.VaultEntryClient = {
        createEntry,
        getEntries,
        getEntry,
        updateEntry,
        deleteEntry,
        decryptEntry
    };
})();