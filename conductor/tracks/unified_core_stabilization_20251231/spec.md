# Track Specification: Unified CLI Core & Intune Audit Stabilization

## 1. Objectives
-   **Stabilize Core Architecture:** Ensure the new TypeScript CLI (`core/src/cli.ts`) is robust, handling errors and edge cases gracefully.
-   **Verify Intune Audit:** Confirm that the `dev:intune-audit` command functions correctly with the recently added permissions (`DeviceManagementManagedDevices.Read.All`).
-   **Enhance Interactive UX:** Polish the `@inquirer/prompts` menus for better navigation and error feedback.
-   **Secure Token Rotation:** Validate that the CLI correctly handles token expiration and rotation using the `TokenStorage` service.

## 2. Scope
-   **In Scope:**
    -   `core/src/cli.ts` (Main entry point)
    -   `core/src/services/auth.ts` (Permission scopes)
    -   `core/src/commands/dev/intune-audit.ts` (Logic verification)
    -   `core/src/services/token-storage.ts` (Rotation checks)
-   **Out of Scope:**
    -   New feature development (other than stability fixes).
    -   Legacy Rust code (archived).

## 3. Technical Implementation
### 3.1 Auth & Permissions
-   Verify `DeviceManagementManagedDevices.Read.All` is requested.
-   Test the "Access Denied" fallback loop: Ensure the user is prompted to re-login or refresh credentials cleanly.

### 3.2 CLI UX Hardening
-   Standardize error messages using `chalk` colors.
-   Ensure `Ctrl+C` exits cleanly from all menus.
-   Add a "Session Info" header to the main menu showing current user/tenant.

### 3.3 Intune Logic
-   Run `dev:intune-audit` against a live tenant (or mocked response) to verify it parses `deviceShellScripts` and `deviceCompliancePolicies` without 403 errors.

## 4. Success Criteria
-   `dev:intune-audit` runs to completion without 403 errors (assuming admin consent).
-   CLI handles invalid tokens by prompting for login, not crashing.
-   Navigation flow (Main Menu -> Sub Menu -> Task -> Back) works seamlessly.
