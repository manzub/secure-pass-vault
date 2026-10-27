The data model prioritises a 'VaultEntry' document/object
yet to decide on a cryptographic implementation to use

'VaultEntries' []
_id — unique record identifier (created by mongodb)
userId — owner reference (relational to the users object/document/collection)
createdAt — creation timestamp
updatedAt — modification timestamp
cryptoVersion — version of the encryption format
iv — encryption nonce used by the encryption algorithm
ciphertext — encrypted entry data

Payloads
the VaultEntry document stores 3 different Entry types [passwords,notes,address] and remained encrypted until decrypted in the browser

type - password, note, address, or diary
title - can be null e.g 'Personal email' (optional)
data - type specific fields
    -- passwords {
        url: full url link
        username: optional
        email: optional
        password: original password text,
        hint: optional
    }
    -- notes/diary {
        format: optional format identifier
        content: free formatted contents. htmlstrings accepted?
        entryDate?
    }
    -- address {
        fullName,
        addressLine1,
        addressLine2: optional,
        country,
        stateOrRegion: optional,
        city,
        postcode,
        phoneNumber: optional?
    }


users and entries relate to each other with a 'userId' key. 
a users collection for account details and authentication-related information.
A vaultEntries collection for encrypted records.
Each vault entry has a userId referencing its owning user.
An index on userId to make it efficient to retrieve a user's entries.

'Users'
_id - unique identifier
email - Account identity and login
passwordHash - Server-side verification of the account password, never the raw password
account_status - authentication features. temp, active etc
vault - encrypted vault-key protection metadata, including normal and recovery unlock routes 
        (IVs, salts and relevant key-derivation parameters, plus a format/version identifier)
createdAt - Account creation timestamp
updatedAt - Account modification timestamp