# 🧑‍💻 o365-cli - Microsoft 365 Administration Toolset

A **hybrid Rust + TypeScript** platform for enterprise-grade Microsoft 365 administration. This project combines secure authentication, interactive TUI, and powerful automation workflows to streamline M365 management tasks.

## 🚀 Architecture

-   **Rust CLI (`cli/`)**: Secure OAuth2 PKCE authentication, macOS Keychain token storage, interactive TUI with Ratatui
-   **TypeScript Workers (`core/`)**: Microsoft Graph API business logic, powered by Bun runtime
-   **Legacy Scripts (`legacy/`)**: Original PowerShell reference implementations for porting

## 📦 Prerequisites

### For Rust CLI (Recommended)
*   **Rust:** Install via [rustup.rs](https://rustup.rs/)
*   **Bun Runtime:** `brew install oven-sh/bun/bun` (macOS) or see [bun.sh](https://bun.sh)
*   **Permissions:** Global Administrator, User Administrator, or specific delegated permissions

### For Legacy PowerShell Scripts
*   **PowerShell:** 5.1 or 7+ (Core)
*   **Modules:**
    ```powershell
    Install-Module Microsoft.Graph -Scope CurrentUser
    Install-Module ExchangeOnlineManagement -Scope CurrentUser
    ```

## 🎯 Quick Start

### Using the Rust CLI (Interactive TUI)
```bash
# Build and run
cd cli && cargo build --release
./target/release/o365-cli

# Or run specific commands headless
./target/release/o365-cli login --tenant common
./target/release/o365-cli run sec:shadow-it -- --dry-run true
```

### Logging
All sessions are logged to `logs/o365-cli_YYYYMMDD_HHMMSS.log` with:
- Session ID for correlation
- Debug-level detail with RFC3339 timestamps
- No overwriting - each run creates a new file

## 📋 Available Modules

| Module | Status | Description | Key Features |
| :--- | :---: | :--- | :--- |
| **Shadow IT Governance** (`sec:shadow-it`) | ✅ **Enhanced** | Detects and remediates risky OAuth apps | 🚨 **NEW:** Permission severity classification (CRITICAL/HIGH/MEDIUM/LOW)<br>• Actionable recommendations<br>• Dual-scan (delegated + app permissions)<br>• Microsoft service principal filtering<br>• Last sign-in tracking<br>• Risk scoring (0-100)<br>• Publisher verification |
| **Graceful Offboarding** (`iam:offboard`) | 🚧 In Progress | Standard user termination protocol | • Block sign-in<br>• Convert to shared mailbox<br>• Hide from GAL<br>• Grant manager access<br>• Reclaim licenses |
| **Guest Cleanup** | 📅 Planned | Stale guest user lifecycle | • Orphan detection<br>• Asset handover<br>• Webhook notifications |
| **Stale Device Cleanup** | 📅 Planned | Remove inactive devices | • TrustType awareness<br>• Hybrid join protection |
| **License Optimization** | 📅 Planned | Identify unused licenses | • Cost analysis<br>• Reclaim suggestions |
| **360° User Analyzer** | 📅 Planned | Comprehensive user reports | • Activity forensics<br>• Device inventory<br>• Group membership |

## 🔐 Security & Authentication

**OAuth2 PKCE Flow**
- Authorization Code Flow with PKCE for secure authentication
- Local HTTP server captures redirect (no copy-paste tokens)
- CSRF validation prevents interception attacks

**Token Storage**
- Refresh tokens stored in **macOS Keychain** (via `keyring` crate with `apple-native` feature)
- Access tokens obtained fresh for each command
- Tokens passed to workers via stdin (not process args)
- Automatic rotation and keyring updates

**Session Management**
- Auto-verification on TUI startup
- Visual feedback: `Auth: ✅ Active` / `Auth: ❌ Expired`
- Profile persistence for seamless re-authentication

## 🛡️ Safety Guidelines

**GOLDEN RULE: TEST BEFORE ACTION**
- **Dry-Run First**: All commands default to `--dry-run true`
- Simulate actions and review output before execution
- TypeScript workers log instead of mutating when dry-run is enabled
- TUI Settings tab provides easy dry-run toggle

**Command Examples**
```bash
# Rust CLI (Dry-Run by default)
./cli/target/release/o365-cli run sec:shadow-it -- --dry-run true

# Live execution (use with caution)
./cli/target/release/o365-cli run sec:shadow-it -- --dry-run false
```

**Legacy PowerShell** (for reference):
```powershell
# Dry-run (default)
.\ShadowITCleanup.ps1 -DryRun $true

# Live execution
.\Invoke-GracefulOffboarding.ps1 -UserPrincipalName "user@company.com" -ManagerEmail "manager@company.com" -DryRun $false
```

## 📊 Logging & Debugging

**Session-Based Logs** (`logs/` directory):
- Format: `o365-cli_YYYYMMDD_HHMMSS.log`
- Debug-level detail with RFC3339 timestamps
- Each session has a unique log file (no overwriting)
- Easy correlation via Session ID

**Log Analysis**:
```bash
# View latest log
ls -lt logs/ | head -1

# Search for errors
grep -i error logs/o365-cli_*.log

# Filter by module
grep "shadow-it" logs/o365-cli_*.log
```

## 📚 Documentation

- **Developer Instructions**: `.github/copilot-instructions.md` - Architecture, IPC protocol, extending the platform
- **Module Research**: `docs/SHADOW_IT_RESEARCH.md` - Permission model, risk scoring algorithm
- **Legacy Context**: Each `legacy/` folder contains a `GEMINI.md` with specific operational logic

## 🤝 Contributing

This is a hybrid platform evolving from PowerShell scripts to a production-ready Rust/TypeScript architecture. The `legacy/` folder serves as reference implementations for porting to the modern stack.
