# 🧑‍💻 o365-cli - Microsoft 365 Administration Toolset

A **TypeScript** platform for enterprise-grade Microsoft 365 administration. This project leverages secure authentication, interactive CLI menus, and powerful automation workflows to streamline M365 management tasks.

## 🚀 Architecture

**100% TypeScript** - Built with Bun runtime for maximum performance.

-   **TypeScript CLI (`core/src/cli.ts`)**: The primary entry point, providing interactive menus, authentication, and command execution.
-   **TypeScript Workers (`core/`)**: Microsoft Graph API business logic, powered by Bun runtime.
-   **Legacy Reference (`legacy/`)**: Original PowerShell scripts archived for reference only (not actively maintained).

## 📦 Prerequisites

*   **Bun Runtime:** `brew install oven-sh/bun/bun` (macOS) or see [bun.sh](https://bun.sh)
*   **Permissions:** Global Administrator, User Administrator, or specific delegated permissions

## 🎯 Quick Start

### Using the TypeScript CLI
```bash
# Install dependencies
cd core && bun install

# Run the interactive CLI
bun run src/cli.ts

# Or run specific commands
bun run src/cli.ts login --tenant common
bun run src/cli.ts run sec:shadow-it -- --dry-run true
```

### Logging
All sessions are logged to `logs/o365-cli_YYYYMMDD_HHMMSS.log` with:
- Session ID for correlation
- Debug-level detail with RFC3339 timestamps
- No overwriting - each run creates a new file

## 📋 Production Modules

The platform currently has **4 production-ready modules**:

| Module | Category | Description |
| :--- | :--- | :--- |
| **`sec:ca-audit`** | Security | Conditional Access policy audit with export |
| **`sec:shadow-it`** | Security | Risky OAuth app detection & remediation |
| **`iam:offboard`** | Identity | User termination with license reclaim |
| **`dev:intune-audit`** | Devices | Intune configuration audit |

**🟡 Beta Modules** (15+ available) - Functional but under active development
**🔴 Draft Modules** - Experimental, not production-ready

See `README.md` for detailed module documentation and usage examples.

## 🔐 Security & Authentication

**OAuth2 PKCE Flow**
- Authorization Code Flow with PKCE for secure authentication
- Local HTTP server captures redirect (no copy-paste tokens)
- CSRF validation prevents interception attacks

**Token Storage**
- Secure token storage handling
- Access tokens obtained fresh for each command
- Tokens passed to workers securely
- Automatic rotation and storage updates

**Session Management**
- Auto-verification on startup
- Visual feedback on session status
- Profile persistence for seamless re-authentication

## 🛡️ Safety Guidelines

**GOLDEN RULE: TEST BEFORE ACTION**
- **Dry-Run First**: All commands default to `--dry-run true`
- Simulate actions and review output before execution
- TypeScript workers log instead of mutating when dry-run is enabled

**Command Examples**
```bash
# TypeScript CLI (Dry-Run by default)
cd core && bun run src/cli.ts run sec:shadow-it -- --dry-run true

# Live execution (use with caution)
cd core && bun run src/cli.ts run sec:shadow-it -- --dry-run false
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
- Debug-level detail with timestamps
- Each session has a unique log file
- Easy correlation

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

- **Main README**: `README.md` - Architecture, production modules, roadmap
- **AI Instructions**: `CLAUDE.md` - For Claude Code AI agent
- **Developer Guide**: `CLAUDE.md` - Architecture, extending the platform
- **Legacy Reference**: Each `legacy/` folder contains archived PowerShell implementations

## 🤝 Contributing

This is a TypeScript platform evolving from PowerShell scripts. The `legacy/` folder serves as reference implementations for porting to the modern stack.

## 🤖 AI/Developer Rules

- **TypeScript Development Verification:** After modifying any TypeScript code, you **MUST** run `bun test` in the `core` directory to verify basic integrity.
  - If tests fail, you **MUST** analyze the error and apply a fix immediately.
  - Do **NOT** report the task as complete until the code passes tests.