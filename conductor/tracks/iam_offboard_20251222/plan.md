# Plan: IAM - Graceful Offboarding Implementation

## Phase 1: Worker Core Logic (TypeScript) [checkpoint: 38db438]
- [x] Task: Create `core/src/commands/iam/offboard.ts` skeleton and setup TDD environment. 3c369e4
- [x] Task: Implement Identity Containment (Disable account, Revoke sessions, Hide from GAL). 553f23f
- [x] Task: Implement Device Isolation (Find associated Intune/Entra devices and Retire/Disable them). 553f23f
- [x] Task: Implement License Reclamation (Remove direct licenses and purge user from all groups). 20840c6
- [x] Task: Implement Mailbox & Data Handoff (Convert to shared, set OOF, and grant manager access). faa578e
- [x] Task: Conductor - User Manual Verification 'Worker Core Logic' (Protocol in workflow.md) 38db438

## Phase 2: Rust TUI Expansion
- [x] Task: Extend `App` state and `InputContext` to support the multi-step offboarding wizard. 7b29904
- [x] Task: Update `ui.rs` to render the new wizard screens (Target -> Manager -> Device Options -> Review). 790e259
- [x] Task: Integrate `iam:offboard` execution into the TUI action handler and process IPC updates. be844e0
- [x] Task: Conductor - User Manual Verification 'TUI Integration' (Protocol in workflow.md) be844e0

## Phase 3: Validation & Zero-Trust Polish
- [~] Task: Verify 'Dry-Run' accuracy (ensure it lists all targeted devices and groups without mutation).
- [~] Task: Conduct end-to-end integration tests using mock Graph API responses.
- [ ] Task: Final code review for security (zero-trust group pruning verification).
- [ ] Task: Conductor - User Manual Verification 'Final Validation' (Protocol in workflow.md)
