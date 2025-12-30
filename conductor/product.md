# Product Guide: o365-cli

## Vision
To provide the ultimate "Swiss Army Knife" for Microsoft 365 Systems Administrators and SecOps professionals—a unified, high-performance, and safe platform for forensics, governance, automation, and threat containment.

## Target Audience
-   **Enterprise IT Systems Administrators:** Professionals managing complex, single-tenant environments who need reliable automation.
-   **Managed Service Providers (MSPs):** Admins responsible for multiple tenants who require efficient context switching and standardized tooling.
-   **Security Operations Center (SOC) Analysts:** Security professionals needing quick access to forensic data, shadow IT reports, and containment tools.

## Core Value Proposition
-   **Unified Experience:** Consolidates disparate administration tasks (Identity, Security, Resources) into a single, cohesive interface.
-   **Performance:** Powered by **Bun** and **TypeScript** to deliver blazing-fast execution compared to traditional PowerShell.
-   **Safety:** Prioritizes "Dry-Run" by default, ensuring admins can verify actions before execution to prevent critical errors.
-   **Interactive Governance:** Moves beyond static scripts to an interactive CLI with guided menus for real-time management.
-   **Active Incident Response:** Provides rapid threat containment and identity isolation capabilities.

## Key Features
-   **Unified TypeScript Architecture:** A high-performance CLI entry point using **Commander.js** and **Inquirer.js** for guided orchestration.
-   **Six Strategic Pillars:** Comprehensive modules for IAM, SEC, GOV (Governance), END (Endpoint), RES, and REP.
-   **Secure Authentication:** Robust OAuth2 PKCE flow with system keychain storage via **keytar**.
-   **Rich Output:** Professional terminal output with interactive tables and real-time logging.