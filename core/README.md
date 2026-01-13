# O365 CLI - Production Release

> **Enterprise-grade Microsoft 365 administration toolkit**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-production-green.svg)]()
[![GitHub](https://img.shields.io/badge/GitHub-RohiRIK%2Fo365--cli-blue?logo=github)](https://github.com/RohiRIK/o365-cli)

## 🚀 Overview

O365 CLI is a high-performance TypeScript-based command-line interface for Microsoft 365 administration. This production branch contains only battle-tested, production-ready modules.

**Built by:** [Rohi Rikman](https://github.com/RohiRIK)
**Repository:** [github.com/RohiRIK/o365-cli](https://github.com/RohiRIK/o365-cli)

## ✨ Features

- **Interactive CLI** - User-friendly prompts and navigation with @inquirer/prompts
- **Microsoft Graph Integration** - Seamless OAuth2 PKCE authentication
- **Production-Ready Modules** - 4 stable modules across 3 categories
- **Export Support** - CSV and text file exports
- **Dry-Run Mode** - Preview changes before execution
- **Type-Safe** - Built with TypeScript for reliability
- **Fast Runtime** - Powered by Bun for exceptional performance

## 📦 Installation

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)
- Microsoft 365 tenant with appropriate permissions
- Azure App Registration (see [Setup Guide](#azure-app-registration))

### Quick Start

```bash
# Clone the repository (prod branch)
git clone -b prod https://github.com/RohiRIK/o365-cli.git
cd o365-cli

# Install dependencies
cd core && bun install

# Run interactive CLI
bun run cli

# Or run specific module
bun run cli run <module-id>
```

## 📋 Available Modules

### 📦 DEV

- **📊 `dev:intune-audit`** - Audit Intune assignments and configuration profiles

### 👤 Identity & Access Management

- **⚡ `iam:offboard`** - Standard user termination protocol with license reclaim

### 🔒 Security & Compliance

- **📊 `sec:ca-audit`** - Detailed technical audit of every Conditional Access policy
- **⚡ `sec:shadow-it`** - Detect and remediate risky OAuth applications



## 🔐 Azure App Registration

1. Navigate to [Azure Portal → App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps)
2. Click **New registration**
3. Configure:
   - **Name**: O365 CLI
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: `http://localhost:8080/callback`
4. After creation, note the **Application (client) ID**
5. Go to **API permissions** → **Add permission** → **Microsoft Graph** → **Delegated permissions**
6. Add required permissions:
   - `User.Read`
   - `Directory.Read.All`
   - `Policy.Read.All`
   - `Policy.ReadWrite.ConditionalAccess` (if using CA modules)
7. Click **Grant admin consent**

## ⚙️ Configuration

Create a `.env` file in the project root:

```bash
CLIENT_ID=your-client-id-here
TENANT_ID=common
LOG_LEVEL=info
```

## 🎯 Usage Examples

### Interactive Mode

```bash
# Launch interactive menu
bun run cli

# Follow prompts to:
# 1. Login to Microsoft 365
# 2. Select a module category
# 3. Run the module
# 4. Export results (optional)
```

### Headless Mode

```bash
# Run specific module with arguments
bun run cli run rep:ca-roadmap --detailed true

# Check session status
bun run cli status

# List all modules
bun run cli list
```

## 📚 Documentation

- **Module Reference**: See module list above for descriptions
- **API Documentation**: [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/overview)
- **OAuth Setup**: See [Azure App Registration](#azure-app-registration)

## 🤝 Contributing

This is the production release branch. For development and contributions:

1. Fork the repository: [github.com/RohiRIK/o365-cli](https://github.com/RohiRIK/o365-cli)
2. Create a feature branch from `dev`
3. Submit a pull request to the `dev` branch
4. Once approved and tested, it will be automatically synced to this production branch

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔒 Security

- All sensitive data is excluded from this branch
- OAuth tokens stored securely in OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- No credentials or secrets in repository
- **Report security issues**: [GitHub Security Advisories](https://github.com/RohiRIK/o365-cli/security/advisories/new)

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/RohiRIK/o365-cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/RohiRIK/o365-cli/discussions)
- **Wiki**: [Documentation](https://github.com/RohiRIK/o365-cli/wiki)

---

**Last Updated**: 2026-01-13
**Production Modules**: 4
**Auto-synced from**: `dev` branch
**Maintainer**: [Rohi Rikman](https://github.com/RohiRIK)
