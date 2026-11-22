# Track Specification: Portable Token Storage and Automatic Rotation

## Overview
Currently, `o365-cli` uses the system Keychain for token storage and lacks automatic rotation, leading to frequent manual re-login prompts. This track refactors token management to use a portable JSON file and implements proactive token refresh logic.

## Functional Requirements
1.  **JSON File Storage:**
    -   Migrate token storage from the `keyring` crate (Keychain) to a local JSON file (e.g., `~/.o365-cli/tokens.json`). 
    -   Ensure the file is created with restricted permissions (Read/Write for current user only).
2.  **Proactive Expiration Check:**
    -   Before every task execution (`RunTask`), the Rust CLI must inspect the stored `access_token` expiration time.
3.  **Automatic Token Rotation:**
    -   If the `access_token` is expired or within a 5-minute buffer of expiration, attempt to exchange the `refresh_token` for a new pair of tokens via the OAuth2 flow.
    -   Update the JSON storage file with the new tokens immediately after a successful refresh.
4.  **Graceful Fallback:**
    -   If no `refresh_token` is found or the refresh attempt fails (e.g., revoked), automatically trigger the interactive browser-based login flow.

## Technical Constraints
-   **Storage Format:** Use `serde_json` to manage the token file structure.
-   **Security:** On Unix systems, set file permissions to `600`.
-   **State Management:** The `AuthManager` in Rust will remain the owner of this logic.

## Acceptance Criteria
-   The system Keychain is no longer used for token storage.
-   Users are not prompted for login if a valid refresh token is available.
-   The TUI "Auth Status" accurately reflects the token health after an automatic refresh.

## Out of Scope
-   Encrypting the JSON file content (relying on OS-level file permissions).
-   Supporting multiple concurrent user profiles.
