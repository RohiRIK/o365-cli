# 🛡️ o365-cli: The Enterprise Governance Platform

> **"The High-Performance CLI" for Microsoft 365 Administrators.**

`o365-cli` is a **comprehensive governance platform** designed to tame the chaos of Microsoft 365 administration. It reimagines daily operations by replacing fragmented, slow PowerShell scripts with a **high-performance TypeScript orchestration engine** powered by the **Bun** runtime.

---

## 🚀 Mission & Vision

Modern M365 tenants are messy. Users grant risky permissions, licenses are wasted on disabled accounts, and offboarding is often a manual checklist.

**o365-cli** automates the lifecycle of your tenant assets:
*   **Identities** (Onboarding, Offboarding, Guests)
*   **Security** (Shadow IT, External Sharing)
*   **Resources** (Licenses, Devices, Teams)

We treat infrastructure as code and governance as a continuous process, not a one-time audit.

---

## 🛠️ Technical Architecture

This project uses a **Unified TypeScript Architecture** optimized for speed and developer experience:

1.  **The Engine (TypeScript + Bun 🍞):**
    *   Handles Orchestration, Authentication (OAuth2 PKCE), and Business Logic.
    *   *Why?* Bun provides incredibly fast startup times and native support for TypeScript. The Microsoft Graph JS SDK is mature and reliable.
2.  **Secure Storage:**
    *   Tokens and configurations are stored securely using the **OS Keychain** via `keytar`.
3.  **Legacy Reference:**
    *   Original PowerShell and Rust implementations are preserved in `legacy/` for architectural reference.

---

## 🏁 Quick Start

### 1. Prerequisites
*   **Bun Runtime:** [Install Bun](https://bun.sh/)
*   **Node.js** (Optional, for some dependencies)

### 2. Install & Authenticate
```bash
cd core
bun install
bun src/cli.ts login --tenant <your-tenant-id>
```

### 3. List Available Modules
```bash
bun src/cli.ts list
```

### 4. Execute a Module (Dry-Run by Default)
```bash
bun src/cli.ts run sec:shadow-it --dry-run true
```

---

## 🧩 Module Ecosystem

The platform supports a wide range of modules across Security, IAM, and Resource Management.

| Category | Modules |
| :--- | :--- |
| **Security** | Shadow IT, MFA Enforcement, Risky Sign-ins, External Sharing |
| **IAM** | Graceful Offboarding, Guest User Cleanup, License Reclaim |
| **Resources** | Stale Device Cleanup, License Optimization, Teams Usage |

---

## 📜 License
MIT
