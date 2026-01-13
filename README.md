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

**100% TypeScript** - Built with Bun runtime for maximum performance.

**Core Components:**
1. **TypeScript Engine** (`core/`)
   - CLI interface with `@inquirer/prompts`
   - OAuth2 PKCE authentication
   - Microsoft Graph API integration
   - Modular handler-based architecture

2. **Bun Runtime** 🍞
   - Near-instant startup times
   - Native TypeScript execution (no build step!)
   - High-performance HTTP and file I/O

3. **Secure Storage**
   - OS Keychain integration via `keytar`
   - Never stores credentials in plaintext

**Note:** Legacy Rust and PowerShell implementations exist in archives for reference only.

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

## 🎯 Production Modules

The platform currently has **4 production-ready modules** across Security, IAM, and Device Management categories.

### Security (SEC)

#### `sec:ca-audit` - Conditional Access Audit
Detailed technical audit of every Conditional Access policy in your tenant.

**Features:**
- Policy-by-policy analysis
- Assignment summaries
- Condition breakdown
- Grant control inspection
- Export to JSON

**Usage:**
```bash
bun src/cli.ts run sec:ca-audit
bun src/cli.ts run sec:ca-audit --export output/ca-policies.json
```

#### `sec:shadow-it` - Shadow IT Governance
Detect and remediate risky OAuth applications with dangerous permissions.

**Features:**
- Identify unverified publishers
- Flag dangerous Graph API permissions
- Detect credential expiry issues
- Auto-remediation with dry-run mode

**Usage:**
```bash
bun src/cli.ts run sec:shadow-it --dry-run true
bun src/cli.ts run sec:shadow-it --dry-run false  # Live remediation
```

### Identity & Access Management (IAM)

#### `iam:offboard` - Graceful User Offboarding
Standard user termination protocol with license reclamation and mailbox conversion.

**Features:**
- Block sign-in
- Revoke all sessions
- Convert mailbox to shared
- Remove from all groups
- Reclaim licenses
- Device retirement (wipe/retire/none)

**Usage:**
```bash
bun src/cli.ts run iam:offboard --user user@domain.com --dry-run true
bun src/cli.ts run iam:offboard --user user@domain.com --device-action wipe --dry-run false
```

### Device Management (DEV)

#### `dev:intune-audit` - Intune Configuration Audit
Comprehensive audit of Intune assignments and configuration profiles.

**Features:**
- Configuration profile analysis
- Assignment mapping
- Compliance policy review
- Export to JSON

**Usage:**
```bash
bun src/cli.ts run dev:intune-audit
bun src/cli.ts run dev:intune-audit --export output/intune-config.json
```

---

## 📍 Module Status Legend

- **🟢 Production** - Fully tested, production-ready (4 modules)
- **🟡 Beta** - Functional but under active development (15+ modules)
- **🔴 Draft** - Experimental or incomplete

All modules support `--dry-run` mode for safe previewing of changes.

---

## 🗺️ Roadmap

### Q1 2026 - Security & Compliance Expansion
- [ ] `sec:mfa-enforcement` - MFA gap analysis and enforcement
- [ ] `sec:risky-sign-ins` - Identity Protection risk detection
- [ ] `sec:external-sharing` - External sharing audit across SharePoint/OneDrive
- [ ] `gov:audit-log-export` - Unified audit log forensics
- [ ] `gov:retention-audit` - Data retention policy compliance

### Q2 2026 - IAM & Resource Management
- [ ] `iam:guest-cleanup` - Automated guest user lifecycle management (move to prod)
- [ ] `iam:stale-accounts` - Inactive user detection and cleanup
- [ ] `res:license-optimization` - License usage analytics and recommendations
- [ ] `res:device-cleanup` - Stale device identification and removal
- [ ] `res:teams-usage` - Teams sprawl analysis

### Q3 2026 - Reporting & Analytics
- [ ] `rep:executive-dashboard` - Executive-level activity summaries
- [ ] `rep:compliance-scorecard` - Security posture scoring
- [ ] `rep:user-analyzer` - Per-user risk and activity profiling

### Future Considerations
- **TUI Dashboard** - Interactive terminal dashboard (Rust-based, maybe)
- **Webhook Integration** - Real-time alerts via webhook
- **Policy Templates** - Pre-built compliance templates (CIS, NIST, etc.)
- **CI/CD Integration** - GitHub Actions for continuous compliance

---

## 🤖 Automated Production Sync

This repository uses **GitHub Actions** to automatically sync production modules from `dev` to `prod` branch.

### How It Works

1. **Development** happens in the `dev` branch (all modules, docs, internal files)
2. **Mark modules as production** by setting `status = "prod"` in handler files
3. **Push to dev** - GitHub Action automatically triggers
4. **Auto-sync to prod** - Only production modules are synced to `prod` branch

### What Gets Synced

**✅ Included in prod:**
- Production modules only (`status = "prod"`)
- Core TypeScript source code
- Automation scripts
- Auto-generated README with module documentation

**❌ Excluded from prod:**
- Development/beta modules (`status = "beta"` or `status = "draft"`)
- Internal documentation (`conductor/`, research docs)
- Sensitive files (secrets, credentials)
- Development artifacts (`node_modules/`, logs)

### Production Branch Stats

- **4 production modules** across 3 categories
- **130 tracked files** (clean & minimal)
- **138 passing tests** (100% coverage for prod modules)
- **Auto-generated README** with installation guide

### Workflow Status

View the automation status at: [GitHub Actions](https://github.com/RohiRIK/o365-cli/actions/workflows/sync-prod.yml)

**Latest sync:** Automatically triggered on every push to `dev`

---

**Want to contribute?** See `CONTRIBUTING.md` or open an issue to discuss new modules!

---

## 📜 License
MIT
