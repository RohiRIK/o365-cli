# Track Plan: Unified CLI Core & Intune Audit Stabilization

## Phase 1: Intune Audit Verification
- [x] Task: Verify Intune Permission Scopes
    -   Context: Check `core/src/services/auth.ts` for `DeviceManagementManagedDevices.Read.All`.
    -   Sub-task: Run manual login test to ensure consent screen requests new scopes.
    -   Sub-task: Debug specific "Access Denied" errors for Scripts (Mac/Win) by inspecting detailed error responses.
- [x] Task: Validate `dev:intune-audit` Execution
    -   Context: Run `bun src/cli.ts run dev:intune-audit --dry-run true`.
    -   Sub-task: Confirm no 403 errors for Shell Scripts or Compliance Policies.
    -   Sub-task: Verify output table formatting.
    -   Sub-task: Fix "None / N/A" assignments for App Protection policies.
- [x] Task: Conductor - User Manual Verification 'Intune Audit Verification' (Protocol in workflow.md)

## Phase 2: CLI Core Hardening
- [ ] Task: Implement Robust Token Expiry Handling
    -   Context: Modify `core/src/services/auth.ts` and `cli.ts`.
    -   Sub-task: Simulate expired token and verify auto-refresh or prompt.
- [ ] Task: Enhance Error Reporting
    -   Context: Update `core/src/utils/output.ts`.
    -   Sub-task: Ensure stack traces are hidden in default mode, shown in verbose.
- [ ] Task: Conductor - User Manual Verification 'CLI Core Hardening' (Protocol in workflow.md)

## Phase 3: UX Polish
- [x] Task: Improve Menu Navigation
    -   Context: `core/src/cli.ts`.
    -   Sub-task: Add clear "Back" options to all sub-menus.
    -   Sub-task: Display "Active Tenant: <id>" in the main menu header.
- [x] Task: Conductor - User Manual Verification 'UX Polish' (Protocol in workflow.md)
