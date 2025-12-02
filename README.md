# 🛡️ o365-cli

**The "Amazing GUI in CLI" for Microsoft 365 Administrators.**

`o365-cli` reimagines administration by replacing slow, linear PowerShell scripts with a high-performance interactive dashboard.

### ⚡ Architecture
* **The Brain (Rust):** A native binary handling OAuth2 PKCE, secure token storage, and rendering a rich TUI (Terminal User Interface) using `Ratatui`.
* **The Muscle (Bun + TypeScript):** Agentic workers that execute complex Graph API logic, running on the blazing fast Bun runtime.

### 🚀 Features
* **Interactive Dashboard:** No more scrolling text. View tables, tabs, and real-time logs in a unified UI.
* **Security Governance:** One-click auditing for Shadow IT and risky OAuth grants.
* **IAM Automation:** Standardized user offboarding/onboarding playbooks.
