# SYSTEM BLUEPRINT & ROADMAP: o365-cli

## 1. Executive Summary
This document serves as the master functional roadmap for the `o365-cli` platform. It bridges legacy PowerShell logic with a modern, hybrid Rust/TypeScript architecture. The ultimate goal is to transform `o365-cli` into the **"Swiss Army Knife" for Microsoft 365 Systems Administrators and SecOps professionals**—providing a single, high-performance interface for forensics, governance, automation, and threat containment.

## 2. Strategic Pillars
The platform is organized into six core pillars, each addressing a critical domain of M365 administration.

### 2.1 IAM: Identity & Access Management
*Focus: Lifecycle management, guest governance, and identity security.*

### 2.2 SEC: Security
*Focus: Threat detection, shadow IT, and security posture enforcement.*

### 2.3 GOV: Governance & Compliance
*Focus: Audit forensics, risk detection, and regulatory compliance.*

### 2.4 END: Endpoint & Device Management
*Focus: Intune orchestration, device health, and endpoint security.*

### 2.5 RES: Resource Management
*Focus: License optimization and stale asset reclamation.*

### 2.6 REP: Reporting
*Focus: 360-degree forensics and executive-level activity summaries.*

## 3. Core Architecture: Unified TypeScript Model
The platform employs a unified, high-performance architecture powered by TypeScript and the Bun runtime, prioritizing developer velocity and execution speed.

### 3.1 The Engine: TypeScript CLI (`core/`)
The `core` directory contains the entire application logic, serving as both the CLI entry point and the execution engine.
- **Interactive CLI:** A rich terminal interface built with `@inquirer/prompts` for intuitive navigation and task selection.
- **Authentication:** Native OAuth2 PKCE implementation handling secure token acquisition and storage via OS Keychain.
- **Execution:** Direct execution of business logic without the overhead of inter-process communication or external binaries.

### 3.2 The Runtime: Bun 🍞
The platform is optimized for the Bun runtime, providing:
- **Instant Startup:** Near-instantaneous CLI boot times compared to Node.js.
- **Native TypeScript:** Direct execution of `.ts` files, eliminating build steps for development.
- **High Performance:** Faster HTTP requests and file I/O operations for data-intensive forensic tasks.

### 3.3 System Design Pattern
The system follows a modular "Service-Handler-Command" pattern:
- **Services:** Singleton classes for cross-cutting concerns (Auth, Graph Client, Token Storage).
- **Handlers:** Routing logic that maps CLI arguments to specific business functions.
- **Commands:** Pure business logic functions that interact with the Microsoft Graph API.
- **Utils:** Shared helpers for output formatting (tables, spinners) and file operations.

---

## 4. Module Maturity Model
To facilitate ideation, modules are tracked through the following stages:
1. **DRAFT:** Initial concept and problem statement identified.
2. **TECH DESIGN:** Graph API endpoints, permissions, and IPC protocols defined.
3. **READY:** Approved for implementation.
4. **LIVE:** Fully implemented in the hybrid stack.

---

## 5. System Integration Standard
To ensure all modules "work and feel the same," every implementation must adhere to this architectural standard.

### 5.1 Command Implementation Pattern
Every module should export a standalone function that accepts typed arguments and handles its own execution flow.
- **Input:** Arguments are passed directly or gathered via interactive prompts if missing.
- **Output:** Use the `IPC` utility (now internal) or standard console output helpers to render tables and progress spinners.
- **Error Handling:** Exceptions should be caught and formatted into user-friendly error messages, avoiding raw stack traces in the UI.

### 5.2 UX Guidelines (The "Feel")

#### 5.2.1 Interactive Menus
The CLI uses `inquirer` for all user interactions.
- **Selection:** Use arrow keys to navigate lists.
- **Filtering:** Lists should support type-ahead filtering for long sets of options.
- **Confirmation:** Destructive actions (non-dry-run) must require an explicit "Yes/No" confirmation step.

#### 5.2.2 Visual Feedback
- **Spinners:** Use `ora` spinners for all async operations to indicate activity.
- **Tables:** Use `cli-table3` (via internal helpers) to present structured data.
- **Colors:**
    - `Cyan`: Information and headers.
    - `Green`: Success and safe states.
    - `Yellow`: Warnings and dry-run indicators.
    - `Red`: Errors and critical risks.

### 5.3 Security & Authentication Standard
The platform prioritizes secure token handling and persistent identity.

#### 5.3.1 OAuth2 PKCE (The "Handshake")
Authentication is performed using the **Authorization Code Flow with PKCE**.
- **Workflow:** The CLI generates a code verifier and challenge.
- **Callback:** A local loopback server (`http://localhost:port`) captures the authorization code.
- **Safety:** Prevents code injection attacks and eliminates the need for client secrets.

#### 5.3.2 Secure Token Storage
Tokens are securely stored using OS-native mechanisms (via `keytar` or similar libraries) or encrypted local files, ensuring credentials are protected at rest.

#### 5.3.3 Session Management
- **Token Rotation:** The CLI automatically checks token expiration and refreshes access tokens using the stored refresh token before every command execution.
- **Scope Awareness:** The system detects if the current token lacks required scopes and prompts for re-authentication.

### 5.4 Worker Implementation Pattern
Each TypeScript worker must extend a base `BaseModule` class to ensure:
- **Graph Client Initialization:** Auto-authenticated via tokens passed from Rust.
- **Graceful Termination:** Listening for `SIGTERM` to close open requests.
- **Standardized Output:** Using a central `IPCService` to format all JSON responses.

---

## 6. Module Definitions

### 6.1 IAM Pillar

#### 6.1.1 Graceful Offboarding
**1. Problem Statement & Value:**
Manual offboarding is prone to error. Leaving access active after departure is a major security risk, while deleting accounts too early can cause data loss. Automated offboarding ensures a consistent "Clean Slate" for every departure.

**2. Legacy Mapping:**
- `legacy/01-IAM-GracefulOffboarding/Invoke-GracefulOffboarding_Action.ps1`

**3. Technical Blueprint:**
- **Endpoints:** 
    - `PATCH /users/{id}` (Block login)
    - `POST /users/{id}/assignLicense` (Remove licenses)
    - `POST /users/{id}/microsoft.graph.convertMailboxToShared` (Exchange Online)
    - `PATCH /users/{id}` (Hide from Address List)
- **Worker Logic:** Verify manager, convert mailbox, set OOF message, remove from groups, and eventually revoke sessions.

**4. TUI Interface Design:**
```text
┌─ IAM: Graceful Offboarding ────────────────────────────────┐
│ User: rohirikman@example.com                               │
│ Manager: admin@example.com                                 │
│                                                            │
│ [~] Blocking Sign-in...                       [ DONE ]     │
│ [~] Converting to Shared Mailbox...           [ DONE ]     │
│ [ ] Granting Manager Access...                [ PEND ]     │
│ [ ] Removing Licenses...                      [ PEND ]     │
│                                                            │
│ Status: Processing... (Stage 2/5)                          │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "progress",
  "data": {
    "step": "Blocking Sign-in",
    "status": "complete",
    "percent": 20
  }
}
```

#### 6.1.2 Guest User Cleanup
**1. Problem Statement & Value:**
Guest accounts are often created for short-term collaboration but never removed, creating a permanent backdoor into the tenant. Automating their removal based on inactivity reduces the identity attack surface.

**2. Legacy Mapping:**
- `legacy/01-IAM-GuestUserCleanup/Invoke-GuestCleanup_Action.ps1`

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /users?$filter=userType eq 'Guest'` (Identify guests)
    - `GET /reports/signInActivity` (Check last login)
    - `DELETE /users/{id}` (Remove guest)
- **Worker Logic:** Filter for `userType: 'Guest'`. Analyze `signInActivity` for inactivity threshold (e.g., 90 days). Support exclusion lists for "Permanent" guests.

**4. TUI Interface Design:**
```text
┌─ IAM: Guest User Cleanup ──────────────────────────────────┐
│ Threshold: 90 Days Inactivity                               │
│                                                            │
│ GUEST UPN          | LAST LOGIN   | ACTION     | STATUS     │
│ -------------------|--------------|------------|------------│
│ guest_1@ext.com    | 120 Days Ago | DELETE     | [ PEND ]   │
│ vendor_x@ext.com   | 15 Days Ago  | KEEP       | [ OK ]     │
│ former_b@ext.com   | NEVER        | DELETE     | [ PEND ]   │
│                                                            │
│ [X] Exclude Selected   [ENTER] Run Cleanup   [D] Change Days│
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "table",
  "data": {
    "headers": ["Guest", "Last Login", "Action"],
    "rows": [["guest_1@ext.com", "120 Days Ago", "DELETE"]]
  }
}
```

#### 6.1.3 New User Onboarding
**1. Problem Statement & Value:**
Setting up new users manually is slow and inconsistent. This module ensures every new joiner has the correct licenses, group memberships, and initial security settings (e.g., MFA registration requirement) from day one.

**2. Legacy Mapping:**
- `legacy/01-IAM-NewUserOnboarding`

**3. Technical Blueprint:**
- **Endpoints:**
    - `POST /users` (Create user)
    - `POST /groups/{id}/members/$ref` (Add to groups)
    - `POST /users/{id}/assignLicense` (Assign SKU)
- **Worker Logic:** Process a JSON/CSV manifest of new users. Handle initial password generation and secure delivery instructions.

**4. TUI Interface Design:**
```text
┌─ IAM: Automated Onboarding ────────────────────────────────┐
│ Processing Manifest: "january_joiners.csv"                  │
│                                                            │
│ USERNAME           | DEP.         | LICENSE    | STATUS     │
│ -------------------|--------------|------------|------------│
│ j.doe@company.com  | Sales        | E5         | [ DONE ]   │
│ a.smith@company.com| Eng          | E3         | [ RUN  ]   │
│ b.lee@company.com  | Finance      | E5         | [ PEND ]   │
│                                                            │
│ Status: Creating smith@company.com (2/12)...               │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "progress",
  "data": { "step": "Creating User", "percent": 15 }
}
```

#### 6.1.4 [SWISS-ARMY] Custom Role Forensic (RBAC Auditor)
**1. Problem Statement & Value:**
Custom Entra ID roles often accumulate "Permission Creep" over time. This module audits custom roles against actual usage to identify and prune unnecessary permissions.

**2. Legacy Mapping:**
- N/A (New Module)

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /roleManagement/directory/roleDefinitions`
    - `GET /roleManagement/directory/roleAssignments`
    - `GET /auditLogs/directoryAudits`
- **Worker Logic:** Map role permissions to audit log actions. Flag roles where >50% of granted permissions have never been used by any assignee in 90 days.

**4. TUI Interface Design:**
```text
┌─ IAM: Custom Role Forensic ────────────────────────────────┐
│ Found 8 Custom Directory Roles                             │
│                                                            │
│ ROLE NAME          | ASSIGNEES    | UNUSED PERMS| RISK      │
│ -------------------|--------------|-------------|-----------│
│ "Cloud Junior"     | 12           | 45%         | MEDIUM    │
│ "Finance Auditor"  | 2            | 10%         | LOW       │
│ "Super Support"    | 5            | 80%         | CRITICAL  │
│                                                            │
│ [V] View Unused   [P] Prune Role   [E] Export Audit        │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "table",
  "data": {
    "headers": ["Role", "Users", "Efficiency"],
    "rows": [["Super Support", "5", "20% Active"]]
  }
}
```

- **[SWISS-ARMY] Conditional Access Optimizer:** Detect redundant or conflicting policies.
- **[SWISS-ARMY] Service Principal Hygiene:** Prune expired/unused high-privilege service principals.

### 6.2 SEC Pillar

#### 6.2.1 Shadow IT Governance
... (existing Shadow IT deep dive) ...

#### 6.2.2 External Sharing Audit
**1. Problem Statement & Value:**
Sensitive data is often shared with "Anyone" or specific external users and forgotten. This module audits all active external links across SharePoint and OneDrive to prevent data leakage.

**2. Legacy Mapping:**
- `legacy/02-SEC-ExternalSharingAudit/Invoke-ExternalSharing_Audit.ps1`

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /sites` (List all sites)
    - `GET /sites/{site-id}/drive/root/children` (Traverse files)
    - `GET /sites/{site-id}/drive/items/{item-id}/permissions` (Check links)
- **Worker Logic:** Recursively traverse site drives. Identify permissions where `link.scope` is `anonymous` or `organization`. Flag high-risk files (e.g., "Passwords.xlsx").

**4. TUI Interface Design:**
```text
┌─ SEC: External Sharing Audit ──────────────────────────────┐
│ Scanning: Finance Site Collection                           │
│                                                            │
│ FILE NAME          | SITE         | LINK TYPE  | RISK       │
│ -------------------|--------------|------------|------------│
│ Budget_2024.pdf    | Finance      | ANONYMOUS  | HIGH       │
│ Project_X.docx     | Operations   | SPECIFIC   | LOW        │
│ Payroll.csv        | HR           | ANONYMOUS  | CRITICAL   │
│                                                            │
│ [R] Revoke Link   [M] Notify Owner   [V] View File Details │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**

```json

{

  "type": "log",

  "level": "info",

  "message": "Scanning Finance Site..."

}

```



#### 6.2.3 Mailbox Permissions Audit

**1. Problem Statement & Value:**

Delegated mailbox access (Full Access, Send As) is a prime target for lateral movement. This module identifies all non-owner permissions to detect unauthorized access or stale delegations.



**2. Legacy Mapping:**

- `legacy/02-SEC-MailboxPermissionsAudit` (Port from PS)



**3. Technical Blueprint:**

- **Endpoints:**

    - `GET /users` (List mailboxes)

    - `GET /users/{id}/mailFolders`

    - `GET /users/{id}/mailboxSettings/userPurpose`

    - **PowerShell (Worker Spawn):** `Get-MailboxPermission` (Required for full Exchange Online forensic depth)

- **Worker Logic:** Execute a hybrid Graph/PowerShell worker to pull granular permissions. Flag "Send-As" rights granted to non-standard users.



**4. TUI Interface Design:**

```text

┌─ SEC: Mailbox Permission Audit ────────────────────────────┐

│ Found 15 Delegation Anomalies                              │

│                                                            │

│ MAILBOX            | USER GRANTED | ACCESS TYPE | RISK     │

│ -------------------|--------------|-------------|----------│

│ ceo@company.com    | admin_x      | FullAccess  | CRITICAL │

│ hr@company.com     | former_emp   | SendAs      | HIGH     │

│ finance@comp.com   | intern_y     | ReadOnly    | MEDIUM   │

│                                                            │

│ [R] Revoke Access   [L] View Access Logs   [S] Skip        │

└────────────────────────────────────────────────────────────┘

```



**5. IPC Protocol Definition:**

```json

{

  "type": "table",

  "data": {

    "headers": ["Mailbox", "Grantee", "Type"],

    "rows": [["ceo@company.com", "admin_x", "FullAccess"]]

  }

}

```



#### 6.2.4 [SWISS-ARMY] Unified Threat Containment

**1. Problem Statement & Value:**

When a compromise is confirmed, SecOps needs to kill all entry points instantly. This module provides a "Tactical Nuke" to block a user, revoke all their sessions, and blacklist their source IP tenant-wide.



**2. Legacy Mapping:**

- `legacy/02-SEC-SurgicalLockdown/Invoke-SurgicalLockdown.ps1`



**3. Technical Blueprint:**

- **Endpoints:**

    - `POST /users/{id}/revokeSignInSessions`

    - `PATCH /users/{id}` (Set `accountEnabled: false`)

    - `POST /identity/conditionalAccess/namedLocations` (Blacklist IP)

- **Worker Logic:** Orchestrate simultaneous API calls. Verify completion of session revocation before confirmation.



**4. TUI Interface Design:**

```text

┌─ SEC: UNIFIED THREAT CONTAINMENT ──────────────────────────┐

│ TARGET: compromised_user@company.com                       │

│                                                            │

│ [!] ACTION: ACCOUNT DISABLE                   [ SUCCESS ]  │

│ [!] ACTION: SESSION REVOCATION                [ SUCCESS ]  │

│ [!] ACTION: IP BLACKLIST (1.2.3.4)            [ PENDING ]  │

│                                                            │

│ WARNING: THIS ACTION IS DESTRUCTIVE AND LIVE               │

│ STATUS: Containment 66% Complete...                        │

└────────────────────────────────────────────────────────────┘

```



---



### 6.3 GOV Pillar

#### 6.3.1 Sign-in Forensic Analyzer
**1. Problem Statement & Value:**
Detecting brute force or impossible travel requires correlation of sign-in logs across various sources. This module provides a forensic "Blast Radius" report for any identity.

**2. Legacy Mapping:**
- N/A (New Module)

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /auditLogs/signIns` (Main source)
    - `GET /identityProtection/riskyUsers`
    - `GET /users/{id}/authentication/methods`
- **Worker Logic:** Group sign-ins by IP/Location/Device. Flag MFA failures or "MFA Fatigue" patterns. Cross-reference with `riskyUsers` endpoint.

**4. TUI Interface Design:**
```text
┌─ GOV: Sign-in Forensic Analyzer ───────────────────────────┐
│ User: rohirikman@example.com                               │
│ Range: Last 24 Hours                                       │
│                                                            │
│ TIME (UTC)   | LOCATION      | IP           | STATUS       │
│ -------------|---------------|--------------|--------------│
│ 14:20:01     | New York, US  | 1.1.1.1      | SUCCESS      │
│ 14:15:30     | London, UK    | 2.2.2.2      | MFA FAILURE  │
│ 14:12:00     | London, UK    | 2.2.2.2      | PASSWD FAIL  │
│                                                            │
│ [!] ALERT: Impossible Travel Detected (NY -> London)       │
│ [K] Kill Sessions   [B] Block IP   [R] Require Password Reset│
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "alert",
  "data": {
    "severity": "CRITICAL",
    "message": "Impossible Travel Detected",
    "suggested_action": "kill_sessions"
  }
}
```

#### 6.3.2 [SWISS-ARMY] Admin Audit Forensic
**1. Problem Statement & Value:**
High-privilege changes (e.g., adding a Global Admin) are often buried in noise. this module provides a "High-Signal" view of administrative mutations to detect insider threats or credential abuse.

**2. Legacy Mapping:**
- N/A (New Module)

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /auditLogs/directoryAudits?$filter=category eq 'RoleManagement'`
    - `GET /auditLogs/directoryAudits?$filter=category eq 'UserManagement'`
- **Worker Logic:** Filter for `result: 'success'`. Map `targetResources` to internal risk levels. Flag any role elevation that didn't originate from a PIM request.

**4. TUI Interface Design:**
```text
┌─ GOV: Admin Audit Forensic ───────────────────────────────┐
│ Range: Last 7 Days | Filter: Mutations                     │
│                                                            │
│ TIME (UTC)   | ACTOR         | ACTION       | TARGET       │
│ -------------|---------------|--------------|--------------│
│ 09:45:12     | admin_z       | Add GA       | service_acc_1│
│ 08:30:00     | system        | Reset Pwd    | ceo@comp.com │
│ 07:15:22     | user_x        | Delete Site  | /sites/hr    │
│                                                            │
│ [!] ALERT: GA Added without PIM Approval                   │
│ [D] View Actor Details   [R] Rollback Action   [S] Search  │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "table",
  "data": {
    "headers": ["Time", "Actor", "Action", "Target"],
    "rows": [["09:45:12", "admin_z", "Add Global Admin", "svc_1"]]
  }
}
```

#### 6.3.3 [SWISS-ARMY] MFA Fatigue Monitor
**1. Problem Statement & Value:**
Attackers often spam users with MFA prompts until they accidentally click "Approve." This module identifies users with unusually high prompt volumes to prevent successful "Push Fatigue" attacks.

**2. Legacy Mapping:**
- N/A (New Module)

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /auditLogs/signIns?$filter=authenticationStepRequirementStatuses/any(s:s/status eq 'mfaRequired')`
    - `GET /reports/credentialUserRegistrationDetails`
- **Worker Logic:** Group sign-ins by user and timestamp. Flag users receiving >5 MFA prompts in a 10-minute window without a successful sign-in.

**4. TUI Interface Design:**
```text
┌─ GOV: Push Fatigue Detection ─────────────────────────────┐
│ Scanning for MFA Spam Patterns (Last 1 Hour)               │
│                                                            │
│ TARGET USER        | PROMPTS      | STATUS     | RISK       │
│ -------------------|--------------|------------|------------│
│ j.doe@company.com  | 14           | UNRESOLVED | CRITICAL   │
│ b.smith@company.com| 2            | IGNORED    | LOW        │
│                                                            │
│ [B] Force Block User   [R] Reset MFA   [N] Notify User     │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "alert",
  "data": { "severity": "HIGH", "message": "MFA Fatigue Attack on j.doe" }
}
```

- **[SWISS-ARMY] Cross-Tenant Collaboration Auditor:** Review B2B sync and access hygiene.
- **[SWISS-ARMY] CA Policy Simulator:** Test policy impact using the What If API.
- **[SWISS-ARMY] OAuth Permission "Blast Radius" Analyzer:** Identify full resource access for apps.

### 6.4 END Pillar

#### 6.4.1 Configuration Drift Detector
... (existing deep dive) ...

#### 6.4.3 [SWISS-ARMY] Intune "Remediation" Fleet Monitor
**1. Problem Statement & Value:**
Proactive remediations are powerful but hard to monitor at scale. This module provides a single dashboard to track script success/failure across the entire fleet.

**2. Legacy Mapping:**
- N/A (New Module)

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /deviceManagement/deviceHealthScripts`
    - `GET /deviceManagement/deviceHealthScripts/{id}/deviceRunStates`
- **Worker Logic:** Fetch all remediation script packages. Aggregate run states (Success, Failed, Pending, Fixed). Identify scripts with high "Fixed" rates (indicating systemic issues).

**4. TUI Interface Design:**
```text
┌─ END: Remediation Fleet Health ────────────────────────────┐
│ Active Scripts: 12 | Fleet Status: 92% Healthy             │
│                                                            │
│ SCRIPT NAME        | SUCCESS      | FIXED      | FAILED     │
│ -------------------|--------------|------------|------------│
│ "Clear Temp Cache" | 1,200        | 450        | 12         │
│ "Fix BitLocker"    | 800          | 2          | 0          │
│ "Sync Clock"       | 150          | 120        | 5          │
│                                                            │
│ [V] View Failed   [R] Run Manually   [E] Export Report     │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "table",
  "data": {
    "headers": ["Script", "Success", "Fixed", "Failed"],
    "rows": [["Fix BitLocker", "800", "2", "0"]]
  }
}
```

- **[SWISS-ARMY] Device Compliance "Reason for Failure" Forensic:** Setting-level deep-dive for non-compliant devices.
- **[SWISS-ARMY] Managed App "Protection Policy" Auditor:** Verify MAM policies on BYOD devices.

### 6.5 RES Pillar

#### 6.5.1 License Optimization
**1. Problem Statement & Value:**
Organizations often over-purchase licenses or fail to reclaim them from inactive users. This module identifies unused "expensive" SKUs (e.g., E5) and suggests downgrades or removals to reduce M365 spend.

**2. Legacy Mapping:**
- `legacy/03-RES-LicenseOptimization/Invoke-LicenseOptimization_Report.ps1`

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /subscribedSkus` (Tenant SKUs)
    - `GET /users?$select=displayName,assignedLicenses`
    - `GET /reports/getOffice365ActiveUserDetail(period='D90')`
- **Worker Logic:** Cross-reference active user detail with assigned licenses. Flag users with E5 licenses who haven't used any premium features (e.g., Defender, Purview) in 90 days.

**4. TUI Interface Design:**
```text
┌─ RES: License Optimization Audit ─────────────────────────┐
│ Estimated Annual Savings: $12,400                          │
│                                                            │
│ USER               | SKU          | LAST USE   | RECO.      │
│ -------------------|--------------|------------|------------│
│ j.doe@company.com  | M365 E5      | 120 Days   | REMOVE     │
│ b.smith@comp.com   | Office E3    | 45 Days    | KEEP       │
│ intern_x@comp.com  | M365 E5      | 90 Days    | DOWNGRADE  │
│                                                            │
│ [R] Reclaim License   [D] Downgrade SKU   [E] Export ROI   │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "table",
  "data": {
    "headers": ["User", "SKU", "Status", "Recommendation"],
    "rows": [["j.doe@company.com", "E5", "Inactive", "REMOVE"]]
  }
}
```

#### 6.5.2 Stale Device Cleanup
**1. Problem Statement & Value:**
Inactive devices clutter the inventory and pose a security risk if they still hold valid tokens. This module identifies and removes devices that haven't checked into Intune or Entra ID for a specified period.

**2. Legacy Mapping:**
- `legacy/03-RES-StaleDeviceCleanup/Invoke-StaleDevice_Cleanup.ps1`

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /devices` (Entra ID devices)
    - `GET /deviceManagement/managedDevices` (Intune devices)
    - `DELETE /devices/{id}`
- **Worker Logic:** Identify devices with `approximateLastSignInDateTime` > threshold (e.g., 180 days). Filter for `trustType: 'Workplace'` vs. `HybridJoined` to avoid deleting corporate infrastructure.

**4. TUI Interface Design:**
```text
┌─ RES: Stale Device Cleanup ────────────────────────────────┐
│ Threshold: 180 Days Inactivity                             │
│                                                            │
│ DEVICE NAME        | OWNER        | TYPE       | LAST SYNC  │
│ -------------------|--------------|------------|------------│
│ IPHONE-14-X        | Alice        | BYOD       | 210 Days   │
│ WKSTN-99           | Bob          | HYBRID     | 190 Days   │
│ MAC-01             | Charlie      | INTUNE     | 15 Days    │
│                                                            │
│ [X] Delete Device   [W] Wipe (Intune)   [S] Skip           │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "progress",
  "data": { "step": "Identifying Stale Devices", "percent": 40 }
}
```

---

### 6.6 REP Pillar

#### 6.6.1 360° Offboarding Analyzer
**1. Problem Statement & Value:**
When an executive or high-privilege user leaves, a simple "Disable" isn't enough. SecOps needs a comprehensive report of every file accessed, every email sent, and every permission held by that user in their final 30 days.

**2. Legacy Mapping:**
- `legacy/04-REP-360OffboardingAnalyzer/Invoke-Employee360_Report.ps1`

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /reports/getSharePointActivityFileCounts`
    - `GET /auditLogs/directoryAudits`
    - `GET /users/{id}/events`
- **Worker Logic:** Aggregates data from SharePoint, Outlook, and Audit logs. Generates a multi-section forensic summary.

**4. TUI Interface Design:**
```text
┌─ REP: 360° User Forensic Summary ──────────────────────────┐
│ Target: former_ceo@company.com                             │
│                                                            │
│ SECTION            | DATA POINT                | RISK      │
│ -------------------|---------------------------|-----------│
│ File Access        | 450 Files (Last 7 Days)   | HIGH      │
│ External Sharing   | 12 Anonymous Links        | CRITICAL  │
│ Admin Actions      | 2 Role Elevations         | MEDIUM    │
│                                                            │
│ [G] Generate PDF   [E] Export JSON   [V] View Timeline     │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "log",
  "level": "info",
  "message": "Aggregating SharePoint activity..."
}
```

#### 6.6.2 Teams Activity Report
**1. Problem Statement & Value:**
IT needs to identify "Ghost Teams" (sites with no activity) to reclaim storage and reduce sprawl. This module identifies Teams with zero chat or file activity in the last 90 days.

**2. Legacy Mapping:**
- `legacy/04-REP-TeamsActivityReport`

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /reports/getTeamsTeamActivityDetail(period='D90')`
    - `GET /groups/{id}/drive/root/children`
- **Worker Logic:** Fetch Teams activity details. Identify groups with `lastActivityDate` > threshold. Verify SharePoint site usage before flagging for deletion.

**4. TUI Interface Design:**
```text
┌─ REP: Teams Sprawl Audit ──────────────────────────────────┐
│ Inactive Teams Found: 42                                   │
│                                                            │
│ TEAM NAME          | LAST ACTIVITY | STORAGE    | OWNER    │
│ -------------------|---------------|------------|----------│
│ "Project Falcon"   | 150 Days Ago  | 45 GB      | b.lee    │
│ "Holiday Party"    | 360 Days Ago  | 2 GB       | system   │
│                                                            │
│ [A] Archive Team   [D] Delete Team   [N] Notify Owner      │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "table",
  "data": {
    "headers": ["Team", "Inactive For", "Size"],
    "rows": [["Project Falcon", "150 Days", "45 GB"]]
  }
}
```

#### 6.6.3 [SWISS-ARMY] Forensic Timeline Generator
**1. Problem Statement & Value:**
Security analysts waste hours manually stitching together logs. This module automatically builds a unified, chronological timeline of an identity's actions across Entra, Teams, SharePoint, and Exchange.

**2. Legacy Mapping:**
- N/A (New Module)

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /auditLogs/signIns`
    - `GET /auditLogs/directoryAudits`
    - `GET /users/{id}/events`
    - `GET /sites/getAllSites`
- **Worker Logic:** Fetch all relevant log streams for a specific 24-48 hour window. Normalize timestamps. Group by "Session ID" to show correlated activities (e.g., Login -> File Download -> Share).

**4. TUI Interface Design:**
```text
┌─ REP: Unified Forensic Timeline ───────────────────────────┐
│ Target: compromised_user@company.com                       │
│                                                            │
│ TIME (UTC)   | SOURCE       | EVENT TYPE   | DETAIL        │
│ -------------|--------------|--------------|---------------│
│ 10:00:01     | Entra ID     | LOGIN        | IP: 1.2.3.4   │
│ 10:05:30     | SharePoint   | DOWNLOAD     | Secret.docx   │
│ 10:06:12     | SharePoint   | SHARE        | To: external  │
│                                                            │
│ [S] Filter Source   [E] Export CSV   [!] Contain Identity  │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "table",
  "data": {
    "headers": ["Time", "Src", "Event", "Detail"],
    "rows": [["10:00:01", "Entra", "Login", "1.2.3.4"]]
  }
}
```