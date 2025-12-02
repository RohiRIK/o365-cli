# 🛡️ o365-cli: The Enterprise Governance Platform

> **"The Amazing GUI in CLI" for Microsoft 365 Administrators.**

`o365-cli` is not just a script repository; it is a **comprehensive governance platform** designed to tame the chaos of Microsoft 365 administration. It reimagines daily operations by replacing fragmented, slow PowerShell scripts with a **high-performance, interactive TUI (Terminal User Interface)**.

---

## 🚀 Mission & Vision

Modern M365 tenants are messy. Users grant risky permissions, licenses are wasted on disabled accounts, and offboarding is often a manual checklist.

**o365-cli** automates the lifecycle of your tenant assets:
*   **Identities** (Onboarding, Offboarding, Guests)
*   **Security** (Shadow IT, External Sharing)
*   **Resources** (Licenses, Devices, Teams)

We treat infrastructure as code and governance as a continuous process, not a one-time audit.

---

## 🖥️ The Interactive Dashboard

Built with **Rust** and **Ratatui**, the CLI provides a blazing fast, keyboard-driven interface.

| Feature | Description |
| :--- | :--- |
| **⚡ Real-Time Logs** | Watch complex backend tasks execute with millisecond precision logs scrolling in real-time. |
| **🔐 Secure Auth** | Built-in **OAuth2 PKCE** flow with token persistence. Log in once, manage forever. |
| **📊 Rich Results** | Results aren't just text; they are interactive **Tables** that you can sort, filter, and export to CSV. |
| **🛑 Safety First** | "Dry Run" is the default. Every destructive action requires explicit confirmation or toggle. |

---

## 🧩 The Module Ecosystem

The platform is divided into four strategic pillars. Each module is designed to solve a specific high-value business problem.

### 👤 Identity & Access Management (IAM)
*Standardizing the chaotic lifecycle of users.*

| Module ID | Name | Primary Goal | Key Metrics / Outcomes |
| :--- | :--- | :--- | :--- |
| **IAM-01** | [Graceful Offboarding](legacy/01-IAM-GracefulOffboarding/README.md) | **Data Preservation** | • 100% Data retention (Mail/OneDrive)<br>• Zero "Zombie" accounts left active |
| **IAM-01-G** | [Guest Lifecycle](legacy/01-IAM-GuestUserCleanup/README.md) | **Perimeter Hygiene** | • Reduction in stale guest accounts<br>• 100% Sponsor attribution for external users |
| **IAM-01-N** | [User Onboarding](legacy/01-IAM-NewUserOnboarding/README.md) | **Day 1 Readiness** | • 0 Day-1 Ticket volume<br>• 100% License & Group accuracy |

### 🛡️ Security & Compliance (SEC)
*Hardening the perimeter and detecting invisible threats.*

| Module ID | Name | Primary Goal | Key Metrics / Outcomes |
| :--- | :--- | :--- | :--- |
| **SEC-02-S** | [Shadow IT Governance](legacy/02-SEC-ShadowITGovernance/README.md) | **App Control** | • Count of Risky OAuth Apps Revoked<br>• % Reduction in "High Risk" scopes |
| **SEC-02-K** | [Surgical Lockdown](legacy/02-SEC-SurgicalLockdown/README.md) | **Incident Containment** | • Time-to-Neutralize (< 60 seconds)<br>• 3-Layer containment (Id, Device, Endpoint) |
| **SEC-02** | [External Sharing](legacy/02-SEC-ExternalSharingAudit/README.md) | **DLP / Exfiltration** | • Count of Anonymous Links removed<br>• Identification of top "Over-Sharers" |
| **SEC-02-M** | [Mailbox Permissions](legacy/02-SEC-MailboxPermissionsAudit/README.md) | **Privilege Monitoring** | • Detection of unauthorized "Full Access" delegates<br>• Identification of Cross-Dept access |

### 💰 Resource Optimization (RES)
*Turning IT from a cost center into a value driver.*

| Module ID | Name | Primary Goal | Key Metrics / Outcomes |
| :--- | :--- | :--- | :--- |
| **RES-03** | [License Optimization](legacy/03-RES-LicenseOptimization/README.md) | **Cost Reduction** | • **$$ Monthly Waste Reclaimed**<br>• Count of "Ghost" & "Zombie" users |
| **RES-03-D** | [Device Sanitizer](legacy/03-RES-StaleDeviceCleanup/README.md) | **Inventory Accuracy** | • % Accuracy of CMDB / Intune<br>• Removal of security-risk (unpatched) stale devices |

### 📈 Deep Reporting (REP)
*Forensic intelligence for decision making.*

| Module ID | Name | Primary Goal | Key Metrics / Outcomes |
| :--- | :--- | :--- | :--- |
| **REP-04** | [360° User Analyzer](legacy/04-REP-360OffboardingAnalyzer/README.md) | **Forensic Insight** | • Full asset map per user (Keys, Sites, Teams)<br>• Flight Risk / Insider Threat indicators |
| **REP-04-T** | [Teams Sprawl](legacy/04-REP-TeamsActivityReport/README.md) | **Collaboration Hygiene** | • Count of Abandoned Teams<br>• Storage reclaimed from dead SharePoint sites |

---

## 🛠️ Technical Architecture

This project uses a **Hybrid Architecture** to leverage the best of all worlds:

1.  **The Brain (Rust 🦀):**
    *   Handles the CLI/TUI, Authentication, Configuration, and State Management.
    *   *Why?* Instant startup, binary safety, and memory efficiency.
2.  **The Muscle (TypeScript + Bun 🍞):**
    *   Executes the complex Graph API business logic.
    *   *Why?* The Graph JS SDK is mature, and Bun provides incredible performance for script execution.
3.  **The Foundation (PowerShell 🐚):**
    *   Legacy scripts provided for backward compatibility and complex Exchange Online operations.

### Prerequisites

*   **Rust Toolchain** (for the CLI)
*   **Bun Runtime** (for the Core logic)
*   **PowerShell 7+** (for legacy modules)

## 🏁 Getting Started

### 1. Clone & Build
```bash
git clone git@github.com:RohiRIK/o365-cli.git
cd o365-cli
cargo build --release --manifest-path cli/Cargo.toml
```

### 2. Run the Dashboard
```bash
./cli/target/release/o365-cli
# Or for development:
cargo run --manifest-path cli/Cargo.toml
```

### 3. Authenticate
Navigate to the **Settings** tab (Press `3`) and select **Login**. The app will launch your browser to authenticate securely with Microsoft Entra ID.

### 4. Execute
Navigate to **Security** or **IAM** tabs, select a module, and press **Enter**.

---

## 📜 License
MIT