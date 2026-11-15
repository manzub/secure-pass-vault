"use strict";

(function (root) {
    function createVaultState() {
        let vaultKey = null;
        let vaultOwnerId = null;
        let operationGeneration = 0;

        return {
            getGeneration() {
                return operationGeneration;
            },

            isCurrent(generation) {
                return generation === operationGeneration;
            },

            isUnlocked() {
                return vaultKey !== null && vaultOwnerId !== null;
            },

            getKey() {
                return vaultKey;
            },

            getOwnerId() {
                return vaultOwnerId;
            },

            unlock(key, ownerId, expectedGeneration) {
                if (expectedGeneration !== operationGeneration) {
                    throw new Error("Stale vault operation");
                }

                if (!key || typeof ownerId !== "string" || !ownerId) {
                    throw new Error("Invalid vault state");
                }

                vaultKey = key;
                vaultOwnerId = ownerId;
            },

            lock() {
                operationGeneration++;
                vaultKey = null;
                vaultOwnerId = null;
            },
            lockIfCurrent(expectedGeneration) {
                if (expectedGeneration !== operationGeneration) {
                    return false;
                }

                operationGeneration++;
                vaultKey = null;
                vaultOwnerId = null;

                return true;
            }
        };
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = createVaultState;
    } else {
        root.createVaultState = createVaultState;
    }
})(globalThis);