# Security Audit Module Research

## 1. Surgical Lockdown (SEC-02-K)

### 🔍 Research Context
The "Surgical Lockdown" is a critical incident response tool. Speed is paramount. The current PowerShell script is effective but slow (sequential execution).

### 🛡️ Enhancement Strategy
*   **Async Execution:** Fire "Block Account", "Revoke Tokens", and "Isolate Device" requests simultaneously using `Promise.all` in TypeScript.
*   **Defender Integration:** The legacy script relies on PowerShell modules. The Graph API now supports Defender for Endpoint actions directly.

### API Implementation Map
| Action | Graph Endpoint | Scope Required |
| :--- | :--- | :--- |
| **Revoke Sessions** | `POST /users/{id}/revokeSignInSessions` | `User.ReadWrite.All` |
| **Reset Password** | `PATCH /users/{id}` | `User.ReadWrite.All` |
| **Disable Account** | `PATCH /users/{id}` (accountEnabled) | `User.ReadWrite.All` |
| **List Devices** | `GET /users/{id}/managedDevices` | `DeviceManagementManagedDevices.Read.All` |
| **Isolate Device** | `POST /deviceManagement/managedDevices/{id}/windowsDefenderScan` | *Correction:* Isolation is usually via `machineAction` in Defender API, not standard Graph. Requires `Machine.Isolate` scope. |

### 🚀 New Capability: "The containment VLAN"
*   Instead of just disabling the user, add them to a "Restricted" Security Group.
*   This group should be targeted by a **Conditional Access Policy** that blocks access to *all* cloud apps. This covers gaps where revocation might delay.

---

## 2. External Sharing Audit (SEC-02)

### 🔍 Research Context
Sharing links (Anonymous/Anyone) are the #1 data leakage vector. Scanning every drive item via Graph is extremely API-intensive (throttling risk).

### 🛡️ Modernization Strategy
*   **Search API vs. Crawl:** Instead of crawling every folder (slow), use the **Microsoft Search API** to query for items with `viewableByExternalUsers:true`.
*   **Delta Queries:** Use `drive/root/delta` to track *changes* in permissions rather than full rescans every time.

### API Implementation Map
| Feature | Endpoint | Efficiency |
| :--- | :--- | :--- |
| **Full Crawl** | `GET /drives/{id}/root/children` (Recursive) | 🔴 Slow, Throttling |
| **Search Query** | `POST /search/query` (Entity: DriveItem) | 🟢 Fast, targeted |
| **Report API** | `GET /reports/getSharePointSiteUsageDetail` | 🟡 High level stats only |

---

## 3. Mailbox Permissions (SEC-02-M)

### 🔍 Research Context
Detecting "FullAccess" delegates is standard. The gap is identifying **Non-Interactive Service Accounts** that have access to human mailboxes (e.g., a backup service that was hacked).

### 🛡️ Enhancement Strategy
*   **Service Principal Mapping:** Specifically flag if the delegate is a `ServicePrincipal` rather than a `User`.
*   **Risk Scoring:**
    *   Delegate is Guest? (Critical)
    *   Delegate is Sync-Disabled? (High)
    *   Mailbox Owner is VIP (C-Level)? (Critical)

### API Limitations
*   Graph API (`/users/{id}/mailFolders`) does **not** easily expose the ACLs for the *entire* mailbox bucket (Full Access) in the same way Exchange PowerShell (`Get-MailboxPermission`) does.
*   **Decision:** This module likely needs to remain a **Hybrid** implementation or rely on **Exchange Online PowerShell V3** invoked from the backend, as Graph parity for mailbox ACLs is still poor.
