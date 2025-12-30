# Technology Stack: o365-cli

## Frontend & Orchestration (CLI)
-   **Language:** TypeScript
-   **Runtime:** **Bun** for instant startup and native TS support.
-   **CLI Framework:** `commander` for argument parsing and `inquirer` for interactive menus.
-   **UI Utilities:** `chalk` for colors, `ora` for spinners, and `cli-table3` for rich table rendering.
-   **Authentication:** `oauth2` (PKCE flow) with **system keychain** storage via `keytar`.

## Core Logic (Graph Integration)
-   **API Integration:** `@microsoft/microsoft-graph-client` for Entra ID and M365 governance.
-   **Security Architecture:** Identity managed via `@azure/identity`.

## Legacy & Reference Layers
-   **Rust TUI:** Original high-performance interactive interface (preserved in `legacy/rust-tui/`).
-   **PowerShell 7+:** Used for complex Exchange Online operations and legacy compatibility.

## Architecture Summary
-   **Unified Model:** A single TypeScript engine handles authentication, user interaction, and Graph API orchestration. Modules are dynamically discovered and executed within the Bun runtime for maximum performance.