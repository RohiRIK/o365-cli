# SYSTEM BLUEPRINT & ROADMAP: o365-cli

## 1. Executive Summary
This document serves as the master functional roadmap for the `o365-cli` platform. It bridges legacy PowerShell logic with a modern, hybrid Rust/TypeScript architecture. The ultimate goal is to transform `o365-cli` into the **"Swiss Army Knife" for Microsoft 365 Systems Administrators and SecOps professionals**—providing a single, high-performance interface for forensics, governance, automation, and threat containment.

## 2. Strategic Pillars
... (pillars) ...

## 3. Core Architecture: The "Brain & Muscle" Hybrid Model
The platform employs a decoupled, high-performance architecture that balances terminal responsiveness with flexible business logic.

### 3.1 The Brain: Rust Orchestrator (`cli/`)
The Rust layer serves as the secure orchestration engine. Its responsibilities include:
- **TUI Rendering:** High-performance UI management using `ratatui`.
- **Authentication & Security:** Managing OAuth2 PKCE flows and AES-encrypted credential storage.
- **Worker Management:** Spawning, monitoring, and capturing output from child processes.
- **IPC Protocol Enforcement:** Parsing incoming JSON-line streams and updating the UI state machine.

### 3.2 The Muscle: TypeScript Workers (`core/`)
The TypeScript layer, executed via the `Bun` runtime, handles all Microsoft Graph API business logic. Its responsibilities include:
- **API Interaction:** Complex Graph API queries, pagination, and data transformation.
- **Stateful Logic:** Evaluating risk scores, detecting configuration drift, and processing bulk updates.
- **Zero-Trust Networking:** Using the access tokens provided by the "Brain" to interact securely with the M365 tenant.

### 3.3 The "Nerve" System: JSON-based IPC
Communication is strictly asynchronous and unidirectional from Muscle to Brain using `stdout`.
1. **Request:** Brain spawns the Worker with command-line arguments.
2. **Context:** Brain passes the access token via `stdin` (preventing sensitive data from appearing in process lists).
3. **Execution:** Worker streams structured JSON updates (Progress, Table Data, Alerts).
4. **Resolution:** Worker exits with code 0 on success or >0 on failure.

---

## 4. Module Maturity Model
... (stages) ...

## 4. System Integration Standard
To ensure all modules "work and feel the same," every implementation must adhere to this architectural standard.

### 4.1 The Rust-to-TypeScript IPC Protocol
Communication follows a strict JSON-line format over `stdin`/`stdout`.
- **Command Dispatch:** Rust spawns `bun core/src/index.ts <module_name> --args...`
- **Standard Message Types:**
    - `{"type": "log", "level": "info", "message": "..."}`: Real-time status in TUI footer.
    - `{"type": "progress", "data": {"step": "...", "percent": 50}}`: Updates the TUI progress bar.
    - `{"type": "table", "data": {"headers": [], "rows": [[]]}}`: Renders the main data view.
    - `{"type": "error", "message": "...", "code": 500}`: Triggers the TUI error modal.

### 4.2 TUI Framework & UX Guidelines (The "Feel")

#### 4.2.1 Global Layout Structure
The interface is divided into three primary functional zones using `ratatui` layouts:
1. **Navigation Sidebar (Left, 20%):** Persistent menu for switching between strategic pillars (Security, IAM, GOV, END, RES, Settings).
2. **Main Workspace (Right, 80%):** Dynamic area that switches between:
    - **Module Menu:** List of available tasks for the current pillar.
    - **Input Prompt:** Modal overlay for gathering task arguments (e.g., Target UPN).
    - **Results Table:** Interactive table with live filtering (`/`), sorting, and detail views (`Enter`).
    - **Review Modal:** Mandatory confirmation gate for live (non-dry-run) actions.
3. **Log & Status Bar (Bottom, Fixed Height):** Real-time feed of IPC messages and authentication status.

#### 4.2.2 State Management & Focus System
The TUI uses a strict focus-based input routing system defined in `app.rs`:
- **`Focus::Menu`:** Sidebar navigation active. `j/k` switches pillars.
- **`Focus::Content`:** Main pillar menu active. `j/k` selects modules, `Enter` starts execution.
- **`Focus::Input`:** Modal prompt active. Captures keyboard strings into `app.input_buffer`.
- **`Focus::Review`:** Decision gate active. Mandatory manual review before non-dry-run execution.
- **`Focus::Filter`:** Active during results viewing. Live search (`/`) filters table rows.
- **`Focus::Logs`:** Bottom pane active. Allows scrolling through session history.

#### 4.2.3 Reusable UI Components
Every module must use these standardized widgets from `ui.rs`:
1. **Module List:** Standardized `List` widget with active/inactive border styling based on focus.
2. **Standard Table:** Multi-column `Table` with auto-scaling widths and custom styling for "Risk" levels.
3. **Forensic Detail View:** A centered popup that renders key-value pairs from a selected table row.
4. **Action Summary Overlay:** A high-visibility modal used in `Focus::Review` to list proposed changes.
5. **Progress Overlay:** A simple status indicator shown during async IPC operations.

#### 4.2.4 TUI Color & Icon Language
Consistency in visual cues is critical for SecOps speed:
- **Icons:** 🕵️ (Security), 👋 (IAM), 🧹 (Cleanup), 🧪 (Test), 🔐 (Auth), 🔎 (Forensics).
- **Colors:**
    - `Blue` / `Cyan`: Active focus and primary information.
    - `Yellow`: Warnings, "Concept" modules, and Dry-Run mode.
    - `Red`: Critical risks, errors, and live destructive actions.
    - `Green`: Successful operations and compliant statuses.

### 4.3 Security & Authentication Standard
The platform prioritizes secure token handling and persistent identity using enterprise-grade encryption.

#### 4.3.1 OAuth2 PKCE (The "Handshake")
Authentication is performed using the **Authorization Code Flow with PKCE (Proof Key for Code Exchange)**.
- **Workflow:** Rust generates a cryptographically random code verifier/challenge.
- **Callback:** A temporary local loopback server (`http://localhost:port`) captures the authorization code.
- **Safety:** Prevents code injection attacks and eliminates the need for client secrets in the binary.

#### 4.3.2 Encrypted JSON Storage (The "Vault")
All sensitive session data is stored in **AES-256-GCM encrypted JSON files** located in `~/.o365-cli/`.
- **Master Key:** Derived from a machine-specific hardware identifier (UUID/Serial) mixed with a project-specific salt.
- **Storage Scope:**
    - `profile.json.enc`: Encrypted user profile data (Name, UPN, Tenant ID).
    - `tokens.json.enc`: Encrypted OAuth2 tokens (Access, Refresh).
- **Security Goal:** Protects against unauthorized local access if the raw JSON files are exfiltrated.

#### 4.3.3 IPC Session Security
To maintain the "Zero-Trust" principle between processes:
- **Naked Tokens:** Access tokens are passed to Workers via `stdin` piping, ensuring they never appear in process lists (`ps aux`) or history files.
- **Short Life:** Workers only hold tokens in memory during execution and never persist them.
- **Token Rotation:** The "Brain" (Rust) is the sole authority for refreshing tokens; Workers must exit and request a re-run if a token expires during long-running tasks.

### 4.4 Worker Implementation Pattern
Each TypeScript worker must extend a base `BaseModule` class to ensure:
- **Graph Client Initialization:** Auto-authenticated via tokens passed from Rust.
- **Graceful Termination:** Listening for `SIGTERM` to close open requests.
- **Standardized Output:** Using a central `IPCService` to format all JSON responses.

---

## 5. Module Definitions

### 4.1 IAM Pillar

#### 4.1.1 Graceful Offboarding
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

---

### 4.2 SEC Pillar

#### 4.2.1 Shadow IT Governance
**1. Problem Statement & Value:**
Users often grant high-risk permissions to third-party apps without IT approval. This module identifies "Over-Permissioned" apps and provides one-click remediation.

**2. Legacy Mapping:**
- `legacy/02-SEC-ShadowITGovernance/Invoke-ShadowIT_Report.ps1`

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /servicePrincipals` (Get all apps)
    - `GET /oauth2PermissionGrants` (Analyze delegated permissions)
    - `GET /appRoleAssignments` (Analyze application permissions)
- **Worker Logic:** Calculate risk score based on scope (e.g., `Mail.ReadWrite` = CRITICAL). Filter out verified Microsoft publishers.

**4. TUI Interface Design:**
```text
┌─ SEC: Shadow IT Audit ─────────────────────────────────────┐
│ Found 42 Third-Party Applications                          │
│                                                            │
│ APP NAME          | PUBLISHER   | RISK     | USERS         │
│ ------------------|-------------|----------|---------------│
│ "Cool Calendar"   | Unverified  | CRITICAL | 12            │
│ "PDF Converter"   | Unknown     | HIGH     | 4             │
│ "Office Themes"   | Verified    | LOW      | 150           │
│                                                            │
│ [ENTER] View Details   [R] Revoke App   [W] Whitelist      │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "table",
  "data": {
    "headers": ["App", "Publisher", "Risk", "Users"],
    "rows": [
      ["Cool Calendar", "Unverified", "CRITICAL", "12"]
    ]
  }
}
```

---

### 4.3 GOV Pillar

#### 4.3.1 Sign-in Forensic Analyzer
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

---

### 4.4 END Pillar

#### 4.4.1 Configuration Drift Detector
**1. Problem Statement & Value:**
Intune policies can fail to apply or be bypassed. IT needs a way to verify that the "Desired State" matches the "Actual State" on endpoints.

**2. Legacy Mapping:**
- N/A (New Module)

**3. Technical Blueprint:**
- **Endpoints:**
    - `GET /deviceManagement/managedDevices`
    - `GET /deviceManagement/deviceConfigurationDeviceStatuses`
    - `GET /deviceManagement/deviceCompliancePolicies`
- **Worker Logic:** Fetch baseline policies. Compare against individual device check-in results. Identify "Non-Compliant" devices with specific setting-level failures.

**4. TUI Interface Design:**
```text
┌─ END: Configuration Drift ─────────────────────────────────┐
│ Policy: Windows 11 Security Baseline                       │
│                                                            │
│ DEVICE NAME   | USER         | STATUS       | DRIFTED SETTINGS│
│ --------------|--------------|--------------|-----------------│
│ WKSTN-01      | Alice        | COMPLIANT    | 0               │
│ WKSTN-05      | Bob          | DRIFTED      | BitLocker, FW   │
│ WKSTN-09      | Charlie      | OFFLINE      | Unknown         │
│                                                            │
│ [S] Sync Policy   [W] Wipe Device   [L] View Logs          │
└────────────────────────────────────────────────────────────┘
```

**5. IPC Protocol Definition:**
```json
{
  "type": "drift_report",
  "data": {
    "device_id": "WKSTN-05",
    "drifted_settings": ["BitLockerEncryption", "FirewallEnabled"],
    "last_sync": "2025-12-22T08:00:00Z"
  }
}
```

---

### 4.5 RES Pillar
- **License Optimization:** Identifying unused or redundant licenses.
    - *Legacy:* `legacy/03-RES-LicenseOptimization`
- **Stale Device Cleanup:** Removing inactive or untrusted devices.
    - *Legacy:* `legacy/03-RES-StaleDeviceCleanup`
- **[CONCEPT] SharePoint Storage Optimizer:** Identify large, unused sites and old versions.
- **[CONCEPT] Mailbox Archive Manager:** Automate move of data to cheaper storage.
- **[CONCEPT] Power Platform Guard:** Monitor for shadow environments and unused flows.

### 4.6 REP Pillar
- **360° Offboarding Analyzer:** Comprehensive forensic report for departed users.
    - *Legacy:* `legacy/04-REP-360OffboardingAnalyzer`
- **Teams Activity Report:** Usage and engagement metrics for Microsoft Teams.
    - *Legacy:* `legacy/04-REP-TeamsActivityReport`
- **[CONCEPT] Executive Governance Dashboard:** High-level PDF/HTML report for C-suite.
- **[CONCEPT] Forensic Timeline Generator:** Build event maps for specific identities.
