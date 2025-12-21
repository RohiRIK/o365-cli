# Track Plan: Enterprise Production Readiness & Guest Lifecycle

## Phase 1: Security & Scalability Foundation [checkpoint: 3839338]
- [x] Task: Implement Encrypted Token Storage in `AuthManager` [e2192b1]
    -   Context: Refactor `cli/src/auth.rs`.
    -   Sub-task: Add `aes-gcm` or equivalent crate to `cli/Cargo.toml`.
    -   Sub-task: Implement key derivation from machine-specific info (e.g., machine-id).
    -   Sub-task: Update `TokenStorage` load/save to handle encryption/decryption.
- [x] Task: Enhance Graph Service with Pagination & Throttling [936736d]
    -   Context: Modify `core/src/services/graph.ts`.
    -   Sub-task: Implement a generic `fetchAll` wrapper that follows `@odata.nextLink`.
    -   Sub-task: Add a global interceptor to catch 429 status codes and wait for `Retry-After`.
- [x] Task: Write Tests for Security & Scalability [936736d]
    -   Context: Add Rust tests for token encryption and TypeScript tests for pagination logic.
- [ ] Task: Conductor - User Manual Verification 'Security & Scalability Foundation' (Protocol in workflow.md)

## Phase 2: UI Safety & Interaction Polish [checkpoint: d765f7d]
- [x] Task: Implement "Review & Confirm" Flow for Destructive Actions [088a94d]
    -   Context: Modify `cli/src/app.rs` and `cli/src/ui.rs`.
    -   Sub-task: Add `AppAction::ReviewProposedActions` and corresponding state.
    -   Sub-task: Update `iam:offboard` flow to stop at a "Review" screen before live execution.
    -   Sub-task: Add a final confirmation hotkey (e.g., `<Ctrl-X>`).
- [x] Task: Enhance Results Navigation (Detail View & Filtering) [3adca01]
    -   Context: Modify `cli/src/ui.rs`.
    -   Sub-task: Create a popup widget for "Selected Row Detail".
    -   Sub-task: Implement local search/filter logic in the TUI for the task results table.
- [ ] Task: Conductor - User Manual Verification 'UI Safety & Interaction Polish' (Protocol in workflow.md)

## Phase 3: Guest User Lifecycle Module [checkpoint: ]
- [ ] Task: Implement `iam:guest-cleanup` Worker
    -   Context: Create `core/src/commands/iam/guest-cleanup.ts`.
    -   Sub-task: Port PowerShell logic for identifying stale guests (>90 days).
    -   Sub-task: Implement logic to identify guests without sponsors (using `user.manager` or `extensionAttributes`).
    -   Sub-task: Implement "Block" and "Remove" remediation actions.
- [ ] Task: TUI Integration for Guest Cleanup
    -   Context: Update `cli/src/app.rs` to include the new module in the IAM tab.
    -   Sub-task: Define the input form for guest cleanup (e.g., "Days Inactive" threshold).
- [ ] Task: Conductor - User Manual Verification 'Guest User Lifecycle Module' (Protocol in workflow.md)

## Phase 4: Final System Verification [checkpoint: ]
- [ ] Task: End-to-End Scalability Test
    -   Sub-task: Run `sec:shadow-it` on a tenant with many apps to verify pagination and throttling.
- [ ] Task: Security Audit
    -   Sub-task: Verify `tokens.json` encryption using a hex editor or `cat`.
- [ ] Task: Conductor - User Manual Verification 'Final System Verification' (Protocol in workflow.md)
