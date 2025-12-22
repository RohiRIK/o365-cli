# Product Guide: o365-cli

## Vision
To provide the ultimate "Swiss Army Knife" for Microsoft 365 Systems Administrators and SecOps professionals—a unified, high-performance, and safe platform for forensics, governance, automation, and threat containment.

## Target Audience
-   **Enterprise IT Systems Administrators:** Professionals managing complex, single-tenant environments who need reliable automation.
-   **Managed Service Providers (MSPs):** Admins responsible for multiple tenants who require efficient context switching and standardized tooling.
-   **Security Operations Center (SOC) Analysts:** Security professionals needing quick access to forensic data, shadow IT reports, and containment tools.

## Core Value Proposition
-   **Unified Experience:** Consolidates disparate administration tasks (Identity, Security, Resources) into a single, cohesive interface.
-   **Performance:** Leverages Rust and Bun/TypeScript to deliver blazing-fast execution compared to traditional PowerShell.
-   **Safety:** Prioritizes "Dry-Run" by default, ensuring admins can verify actions before execution to prevent critical errors.
-   **Interactive Governance:** Moves beyond static scripts to an interactive TUI (Terminal User Interface) for real-time monitoring and management.
-   **Active Incident Response:** Provides "Tactical Nuke" capabilities for rapid threat containment and identity isolation.

## Key Features (Inferred)
-   **Hybrid Architecture:** Rust CLI/TUI frontend for speed and safety, with a TypeScript/Graph API backend for flexible business logic.
-   **Six Strategic Pillars:** Comprehensive modules for IAM, SEC, GOV (Governance), END (Endpoint), RES, and REP.
-   **Secure Authentication:** Robust OAuth2 PKCE flow with AES-256-GCM encrypted JSON storage.
-   **Rich Output:** Interactive tables, real-time logging, and export capabilities.