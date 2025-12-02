# IAM Module Research & Enhancement Plan

## 1. Graceful Offboarding (IAM-01)

### 🔍 Current Limitations (Legacy)
*   **Linear Execution:** PowerShell script runs sequentially. If Exchange hangs, the whole process stalls.
*   **State Amnesia:** No record of "Phase 1 complete, Phase 2 pending". If the script crashes, you have to start over, potentially causing errors (e.g., trying to convert an already converted mailbox).
*   **Hardcoded Delays:** Relies on `Start-Sleep` for replication, which is unreliable.

### 🛡️ Modernization Strategy (Graph API)
*   **Workflow Engine:** Needs a state machine (e.g., "User Disabled", "Tokens Revoked", "Mailbox Converting").
*   **Parallelism:** Can perform Entra ID actions (Block, Revoke) while waiting for Exchange operations.

###  API Implementation Map
| Action | Legacy Cmdlet | Graph API / Modern Approach |
| :--- | :--- | :--- |
| **Block Sign-in** | `Set-MsolUser -BlockCredential` | `PATCH /users/{id} { "accountEnabled": false }` |
| **Revoke Tokens** | `Revoke-AzureADUserAllRefreshToken` | `POST /users/{id}/revokeSignInSessions` |
| **Convert Mailbox** | `Set-Mailbox -Type Shared` | **Gap:** Graph has limited mailbox management. Must use **Exchange v3 PowerShell** via local shell or extensive Graph `HTTP` requests to Exchange endpoints if supported. *Research indicates Exchange PS is still required for reliable conversion.* |
| **Delegate Access** | `Add-MailboxPermission` | `POST /users/{id}/permissions` (Graph Beta for Calendar) / Exchange PS for Full Access. |
| **Remove Licenses** | `Set-MsolUserLicense` | `POST /users/{id}/assignLicense` (add/remove in one call). |
| **Wipe Mobile** | `Clear-MobileDevice` | `POST /users/{id}/managedDevices/{id}/wipe` or `retire`. |

### 🚀 Feature Enhancements
1.  **OneDrive Retention Lock:** Automatically apply a specific retention label to the user's OneDrive before deletion to ensure legal hold compliance without keeping the account active.
2.  **Auto-Reply Injection:** Inject a standard OOF message using Graph API (`/mailboxSettings/automaticRepliesSetting`) immediately upon termination.
3.  **Recurring Calendar Wiper:** optional logic to cancel all future meetings organized by the leaver to free up room resources.

---

## 2. Guest User Lifecycle (IAM-01-G)

### 🔍 Current Limitations
*   **Binary Logic:** Only looks at `LastSignIn`. Doesn't consider if the guest has been active in SharePoint or Teams (passive usage).
*   **No Sponsor Loop:** If no manager is defined, it just screams into the void (Webhook). It lacks a "Ask the Sponsor" feedback loop.

### 🛡️ Modernization Strategy
*   **Interactive Bot:** Instead of a webhook, send an Adaptive Card to the Sponsor via Teams: *"Guest X expires in 7 days. Renew?"*
*   **Deep Activity Audit:** Query `auditLogs/signIns` AND `auditLogs/sharePoint` to detect passive file access.

### API Implementation Map
| Feature | Graph Endpoint | Note |
| :--- | :--- | :--- |
| **Activity Check** | `/users/{id}/signInActivity` | Check `lastNonInteractiveSignInDateTime` as well. |
| **Sponsor Lookup** | `/users/{id}/manager` | If null, scan `/auditLogs/directoryProvisioning` to find the inviter. |
| **Expiration** | Custom Attribute or Database | Store `lifecycleExpirationDate` in `extensionAttributes` for tracking. |

---

## 3. New User Onboarding (IAM-01-N)

### 🔍 Current Limitations
*   **CSV Dependency:** Relies on static CSV files.
*   **Password Transmission:** Sending passwords via email to the manager is insecure.

### 🛡️ Modernization Strategy
*   **TAP (Temporary Access Pass):** Generate a TAP instead of a password. This allows passwordless first-time onboarding (MFA setup) without sharing secrets.
*   **Group Modeling:** "Clone" a reference user's group memberships (`/users/{ref}/memberOf`).

### API Implementation Map
| Feature | Graph Endpoint | Note |
| :--- | :--- | :--- |
| **Create User** | `POST /users` | Use `passwordProfile` or TAP. |
| **TAP Creation** | `POST /users/{id}/authentication/temporaryAccessPassMethods` | Returns a time-limited passcode. |
| **Dynamic Licensing** | `POST /users/{id}/assignLicense` | Use Group-based licensing instead of direct assignment where possible. |
