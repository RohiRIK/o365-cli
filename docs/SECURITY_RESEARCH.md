# Security Audit Module Research & Enhancement Plan

## 1. Surgical Lockdown (SEC-02-K)

### 🔍 Research Context
Speed is critical. We must execute blocking actions immediately without waiting for long round-trips.

### ⚙️ API Implementation Specifications

#### **A. Revoke Sessions (Kill Switch)**
*   **Endpoint:** `POST /users/{id}/revokeSignInSessions`
*   **Best Practice:**
    *   **Priority:** Execute this *first*, before password reset.
    *   **Concurrency:** If targeting multiple users, use `Promise.all` (JS) or `tokio::spawn` (Rust) to fire requests in parallel. DO NOT run sequentially.

#### **B. Reset Password**
*   **Endpoint:** `PATCH /users/{id}`
*   **Payload:** `{ "passwordProfile": { "password": "...", "forceChangePasswordNextSignIn": true } }`
*   **Best Practice:**
    *   **Complexity:** Generate a 64-char string with Upper, Lower, Numbers, and Symbols.
    *   **Logging:** Do NOT log the generated password to the console/file unless strictly necessary for recovery (and then, encrypt it).

#### **C. Managed Device Isolation (Defender)**
*   **Endpoint:** `POST /deviceManagement/managedDevices/{id}/windowsDefenderScan` (Wait, this is scan, not isolate).
*   **Correct Endpoint:** `POST /deviceManagement/managedDevices/{id}/cleanWindowsDevice` (Wipe) OR custom action via MDE API.
*   **Real Best Practice:** Use the **Microsoft Defender for Endpoint API** (separate from Graph) for `isolate`.
    *   URL: `https://api.securitycenter.microsoft.com/api/machines/{id}/isolate`
    *   **Graph Alternative:** `POST /deviceManagement/managedDevices/{id}/logoutSharedUser` (For shared devices).
    *   **Note:** Graph support for "Isolate" is limited/beta. Recommended to fallback to "Retire" (`POST /deviceManagement/managedDevices/{id}/retire`) for Graph-only implementations, which wipes corporate data.

---

## 2. External Sharing Audit (SEC-02)

### 🔍 Research Context
Scanning every file is too slow.

### ⚙️ API Implementation Specifications

#### **A. Targeted Search (Fast)**
*   **Endpoint:** `POST /search/query`
*   **Payload:**
    ```json
    {
      "requests": [
        {
          "entityTypes": [ "driveItem" ],
          "query": { "queryString": "accessType:Everyone" }
        }
      ]
    }
    ```
*   **Best Practice:**
    *   **KQL:** Use Keyword Query Language (KQL) to find items where `ViewableByExternalUsers=true`.
    *   **Limits:** Search API has limits on result size. Use pagination.

#### **B. Delta Queries (Continuous Monitor)**
*   **Endpoint:** `GET /drives/{driveId}/root/delta`
*   **Best Practice:**
    *   **Token Storage:** Store the `nextLink` or `deltaLink` token locally.
    *   **Efficiency:** Only process items that changed since the last scan. Huge performance boost.

---

## 3. Mailbox Permissions (SEC-02-M)

### 🔍 Research Context
Graph API gap for Mailbox ACLs.

### ⚙️ API Implementation Specifications

#### **A. Exchange PowerShell via Graph (Batching)**
*   **Limitation:** Graph does not natively support `Get-MailboxPermission` efficiently for all users.
*   **Workaround:** We must use the **Exchange Online PowerShell V3 module**.
*   **Rust/TS Integration:** The Rust CLI should spawn a `pwsh` child process to run a tightly scoped script:
    `Get-Mailbox -ResultSize Unlimited | Get-MailboxPermission | Where-Object { $_.User -notlike "NT AUTHORITY\*" }`
*   **Parsing:** Output the PS result as JSON (`ConvertTo-Json`) and pipe it back to the Rust/TS worker for analysis.

#### **B. Service Principal Analysis**
*   **Endpoint:** `GET /servicePrincipals/{id}`
*   **Best Practice:**
    *   **Check:** If a delegate User ID maps to a Service Principal, check its `accountEnabled` status and `passwordCredentials` expiry.
    *   **Risk:** Service Principals with mailbox access are high-value targets.