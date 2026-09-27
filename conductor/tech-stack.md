# Technology Stack: o365-cli

## Primary Stack (TypeScript/Bun)
-   **Language:** **TypeScript** is the mandatory language for all core orchestration, API logic, and complex CLI features.
-   **Runtime:** **Bun** is the standard runtime and package manager. It provides high performance, native TypeScript support, and a unified development experience.
-   **CLI Framework:** `commander` for command structure and `@inquirer/prompts` for interactive user journeys.
-   **Authentication:** OAuth2 PKCE flow with secure local token storage.

## Secondary Stack (PowerShell)
-   **Language:** **PowerShell 7+** is a supported secondary option for specialized administration tasks, Exchange Online operations, or when rapid scripting is preferred by the team.
-   -   **Requirement:** PowerShell scripts must adhere to the project's directory structure (e.g., residing in relevant module folders) and should be designed to be called by the TypeScript orchestrator if they perform core functions.

## Legacy Reference Layers
-   **Legacy PowerShell:** Archived modules in `legacy/` serve as the reference implementation for modern TypeScript ports.

## Architecture Summary
-   **Unified Engine:** A single TypeScript/Bun entry point (`core/src/cli.ts`) serves as the primary gateway for all administrative actions, regardless of whether the underlying logic is implemented in TypeScript or triggered as a PowerShell subprocess.
