# IAM Module Research & Enhancement Plan

## 1. Graceful Offboarding (IAM-01)

### 🔍 Current Limitations (Legacy)
*   **Linear Execution:** PowerShell script runs sequentially. If Exchange hangs, the whole process stalls.
*   **State Amnesia:** No record of "Phase 1 complete, Phase 2 pending".
*   **Hardcoded Delays:** Relies on `Start-Sleep` for replication.

### 🛡️ Modernization Strategy
*   **State Machine:** Track status in a local SQLite/JSON file to allow resuming after failure.
*   **Parallelism:** Fire Entra ID blocks and Token revocation in parallel.

### ⚙️ API Implementation Specifications

#### **A. Block Sign-in**
*   **Endpoint:** `PATCH /users/{id}`
*   **Payload:** `{ "accountEnabled": false }`
*   **Best Practice:**
    *   **Fields:** Select minimal fields first to verify state: `$select=id,accountEnabled`.
    *   **Idempotency:** Check if `accountEnabled` is already `false` before patching to save API quota.
    *   **Log:** Record the timestamp of disablement for audit.

#### **B. Revoke Tokens**
*   **Endpoint:** `POST /users/{id}/revokeSignInSessions`
*   **Best Practice:**
    *   **Timing:** This action invalidates *Refresh Tokens*. Access Tokens live for ~60 mins. Real-time lockout is not instant without Continuous Access Evaluation (CAE).
    *   **Error Handling:** Ignore `404` if user is already deleted.

#### **C. Manager Delegation (Mailbox)**
*   **Endpoint (Graph):** `POST /users/{id}/permissions` (Beta) - *Experimental*
*   **Endpoint (Exchange):** Use PowerShell via PSSession (Remote) as Graph mailbox permission support is incomplete.
*   **Best Practice:**
    *   **Auto-Mapping:** When using Exchange PS, set `-AutoMapping $true` so the mailbox appears in the manager's Outlook automatically.
    *   **Retries:** Exchange propagation takes time. Implement exponential backoff (retry 3 times with 5s, 15s, 30s delays).

#### **D. Remove Licenses**
*   **Endpoint:** `POST /users/{id}/assignLicense`
*   **Payload:** `{ "addLicenses": [], "removeLicenses": [ "skuId1", "skuId2" ] }`
*   **Best Practice:**
    *   **Batching:** Do NOT loop. Remove *all* licenses in a single `assignLicense` call by passing all `skuIds` in the array.
    *   **Validation:** Ensure `addLicenses` is empty to avoid accidental assignment.

---

## 2. Guest User Lifecycle (IAM-01-G)

### 🔍 Current Limitations
*   **Binary Logic:** Ignores passive activity (SharePoint views).
*   **No Sponsor Loop:** Webhook-only approach is a black hole.

### 🛡️ Modernization Strategy
*   **Deep Audit:** Query unified audit logs for *any* activity, not just interactive logins.

### ⚙️ API Implementation Specifications

#### **A. Activity Analysis**
*   **Endpoint:** `GET /users/{id}?$select=signInActivity,createdDateTime`
*   **Endpoint:** `GET /auditLogs/signIns?$filter=userId eq '{id}'`
*   **Best Practice:**
    *   **Non-Interactive:** Check `signInActivity.lastNonInteractiveSignInDateTime`. Guests often sync files (OneDrive) without interactively logging in.
    *   **Thresholds:** Configurable "Safe Period" (e.g., 90 days).

#### **B. Sponsor Lookup**
*   **Endpoint:** `GET /users/{id}/manager`
*   **Fallback Strategy:**
    1.  Check `manager` attribute.
    2.  (Advanced) Scan `auditLogs/directoryProvisioning` to find the `initiator` (the person who invited the guest).
    3.  (Advanced) Check `createdDateTime` and search Audit Logs for "Invite user" events around that time.

#### **C. Handover (SharePoint)**
*   **Endpoint:** `GET /users/{id}/drive/root/children` (List files)
*   **Best Practice:**
    *   **Ownership:** We cannot easily "transfer" ownership of a personal drive folder.
    *   **Action:** Instead, generate a **Sharing Link** (`POST /drives/{driveId}/items/{itemId}/createLink`) for the Manager with `type: "view"` or `type: "edit"` before deleting the user.

---

## 3. New User Onboarding (IAM-01-N)

### 🔍 Current Limitations
*   **Insecure Credentials:** Emailing passwords is bad hygiene.

### ⚙️ API Implementation Specifications

#### **A. Create User**
*   **Endpoint:** `POST /users`
*   **Best Practice:**
    *   **UPN Sanitization:** Remove spaces, special chars from UPN. Check for collision (`GET /users/{upn}`) before create.
    *   **Retry:** Handle `409 Conflict` (User exists) by appending a number (e.g., `john.doe2`).

#### **B. Temporary Access Pass (TAP)**
*   **Endpoint:** `POST /users/{id}/authentication/temporaryAccessPassMethods`
*   **Payload:** `{ "lifetimeInMinutes": 60, "isUsableOnce": false }`
*   **Best Practice:**
    *   **Policy Check:** Ensure the tenant has TAP enabled in Authentication Methods Policy. If not, fallback to Password.
    *   **Delivery:** Display TAP to Admin console or send via SMS (if phone number provided), NEVER email the TAP + UPN together.

#### **C. Dynamic Licensing**
*   **Endpoint:** `POST /groups/{id}/members/$ref`
*   **Payload:** `{ "@odata.id": "https://graph.microsoft.com/v1.0/directoryObjects/{userId}" }`
*   **Best Practice:**
    *   **Group-Based Licensing:** Do NOT assign licenses directly. Add the user to a "Licensing Group" (e.g., "E5-Users").
    *   **Why?** Easier to manage, reduces API calls, handles consistency better.

---

## 4. Regular User Lifecycle (IAM-02)

### 🔍 Purpose
Detect stale internal accounts that are not Guests. Employees leave, go on sabbatical, or switch roles, leaving dormant accounts that increase attack surface.

### ⚙️ API Implementation Specifications

#### **A. Stale User Detection**
*   **Endpoint:** `GET /users?$select=displayName,userPrincipalName,signInActivity,createdDateTime,accountEnabled,userType`
*   **Filter:** `userType eq 'Member'`
*   **Logic:**
    *   **Active:** `lastSignIn` < 30 days.
    *   **Stale:** `lastSignIn` > 90 days.
    *   **Dormant:** `lastSignIn` > 180 days.
    *   **Ghost:** `createdDateTime` > 30 days AND `lastSignIn` is null (Never logged in).

#### **B. Reporting Table**
| Status | User Name | Type | Last Active | Days Inactive | Manager | Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 🟢 Active | John Doe | Member | 2023-10-20 | 2 | Jane Boss | Low |
| 🟡 Stale | Old Account | Member | 2023-05-01 | 160 | N/A | Medium |
| 🔴 Ghost | Test User | Member | Never | 45 | N/A | High |

---

## 5. Disabled User License Audit (IAM-03)

### 🔍 Purpose
Identify "Zombie" accounts: Users who are disabled (`AccountEnabled=false`) but still holding onto expensive licenses (e.g., E5). This is 100% financial waste.

### ⚙️ API Implementation Specifications

#### **A. Zombie Hunting**
*   **Endpoint:** `GET /users?$filter=accountEnabled eq false&$select=id,displayName,userPrincipalName,assignedLicenses`
*   **Logic:**
    *   Filter users where `assignedLicenses.length > 0`.
    *   Map `skuId` to Price (using hardcoded map or external price API).

#### **B. Assignment Type Check**
*   **Endpoint:** `GET /users/{id}/licenseDetails`
*   **Property:** `assignmentPaths`
*   **Logic:**
    *   If `assignmentPaths` implies `Direct` -> **Action:** Remove License directly.
    *   If `assignmentPaths` implies `Group` -> **Action:** Remove User from Group.

#### **C. Reporting Table**
| Waste/Mo | User Name | Disabled Date | License SKU | Assignment | Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 🔴 $57.00 | Ex-Employee | 2023-01-15 | Office 365 E5 | Direct | Reclaim |
| 🟠 $20.00 | Contractor | 2023-08-20 | Visio Plan 2 | Group | Remove from Grp |

---

## 6. Privileged User Audit (IAM-04)

### 🔍 Purpose
Audit "Keys to the Kingdom". Identify who has Global Admin or other high-privilege roles, and ensure they are secured (MFA, PIM).

### ⚙️ API Implementation Specifications

#### **A. Role Discovery**
*   **Endpoint:** `GET /directoryRoles` (to get IDs for "Global Administrator", "Exchange Administrator", etc.)
*   **Endpoint:** `GET /directoryRoles/{roleId}/members`
*   **Best Practice:** Also check **PIM (Privileged Identity Management)** assignments if license permits (`GET /roleManagement/directory/roleAssignmentScheduleInstances`).

#### **B. Security Checks**
*   **MFA Status:** `GET /reports/authenticationMethods/userRegistrationDetails/{id}`
    *   Check `isMfaRegistered` and `isCapable`.
*   **Sign-in Analysis:** `GET /users/{id}/signInActivity`
    *   Check `lastSignInDateTime`. Admins who haven't signed in for 30 days are risky (Dormant Admin).

#### **C. Reporting Table**
| Risk | User Name | Role(s) | MFA Status | Last Admin Sign-in | PIM Enabled |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 🔴 Crit | Admin Joe | **Global Admin** | ❌ Disabled | 2023-10-22 | No |
| 🟢 Low | Super Jane | Exchange Admin | ✅ Enforced | 2023-10-21 | Yes |
| 🟠 High | Backup Svc | SharePoint Admin | ❌ Disabled | Never | N/A |
