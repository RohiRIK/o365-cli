# Track Plan: Portable Token Storage and Automatic Rotation

## Phase 1: Migration to JSON Storage [checkpoint: 8867797]
- [x] Task: Implement JSON Token Storage in `AuthManager` [211d784]
    -   Context: Refactor `cli/src/auth.rs` to replace `keyring` usage with file-based I/O.
    -   Sub-task: Define `TokenStorage` struct and implement `load` and `save` methods using `serde_json`.
    -   Sub-task: Implement file permission setting (600) for the token file.
- [x] Task: Write Tests for Token Storage [211d784]
    -   Context: Create unit tests in `cli/src/auth.rs` (Red Phase).
    -   Sub-task: Verify that tokens are correctly serialized/deserialized.
    -   Sub-task: Verify that file permissions are set correctly on Unix-like systems.
- [ ] Task: Conductor - User Manual Verification 'Migration to JSON Storage' (Protocol in workflow.md)

## Phase 2: Automatic Rotation Logic [checkpoint: f12ad94]
- [x] Task: Implement Token Refresh in `AuthManager` [fc0448a]
    -   Context: Update `cli/src/auth.rs` to include rotation logic.
    -   Sub-task: Implement `refresh_tokens` method using the OAuth2 refresh token flow.
    -   Sub-task: Update `get_access_token` to proactively check expiration and call `refresh_tokens` if needed.
- [x] Task: Write Tests for Token Rotation [fc0448a]
    -   Context: Add unit tests in `cli/src/auth.rs` (Red Phase).
    -   Sub-task: Mock the OAuth2 provider to simulate token expiration and successful refresh.
    -   Sub-task: Verify that the storage file is updated with new tokens after rotation.
- [ ] Task: Conductor - User Manual Verification 'Automatic Rotation Logic' (Protocol in workflow.md)

## Phase 3: UI & TUI Integration [checkpoint: ]
- [ ] Task: Update TUI Status Display
    -   Context: Modify `cli/src/app.rs` and `cli/src/ui.rs`.
    -   Sub-task: Update `AuthStatus` to reflect proactive refresh attempts.
    -   Sub-task: Ensure the TUI periodically checks token health (via `on_tick`).
- [ ] Task: Integrate Refresh in Command Execution
    -   Context: Update the `RunTask` handler in `cli/src/tui.rs`.
    -   Sub-task: Ensure a fresh token is always requested from `AuthManager` before starting a worker.
- [ ] Task: Conductor - User Manual Verification 'UI & TUI Integration' (Protocol in workflow.md)

## Phase 4: Final Verification [checkpoint: ]
- [ ] Task: End-to-End Manual Test
    -   Sub-task: Log in normally. Manually modify the token file to set an expired timestamp.
    -   Sub-task: Run a task (e.g., `sec:shadow-it`) and verify that rotation happens silently and successfully.
- [ ] Task: Conductor - User Manual Verification 'Final Verification' (Protocol in workflow.md)
