# Track Plan: Shadow IT Forensic Enrichment

## Phase 1: API & Data Model Enrichment [checkpoint: ]
- [x] Task: Expand `RiskyGrant` Interface and Data Fetching [8189286]
    -   Context: Modify `core/src/commands/sec/shadow-it.ts`.
    -   Sub-task: Add `appId`, `servicePrincipalId`, and `principalId` to the `RiskyGrant` interface.
    -   Sub-task: Update Graph API calls to fetch precise `signInActivity` (last successful, failures) and `passwordCredentials`/`keyCredentials` details.
    -   Sub-task: Implement `resolveScopeDescriptions` to fetch human-readable strings for permissions.
- [x] Task: Update Risk Scoring & Classification [cd9be43]
    -   Context: Modify `calculateRiskScore` and `generateRecommendation` in `shadow-it.ts`.
    -   Sub-task: Incorporate "Credential Age" and "Sign-in Failure Rate" into the risk algorithm.
    -   Sub-task: Add "Classification Source" metadata to each finding.
- [ ] Task: Write Tests for Data Enrichment
    -   Context: Create `core/src/commands/sec/shadow-it.test.ts` (Red Phase).
    -   Sub-task: Verify that all new forensic fields are correctly populated from mock Graph responses.
- [ ] Task: Conductor - User Manual Verification 'API & Data Model Enrichment' (Protocol in workflow.md)

## Phase 2: TUI Detail View Refactor [checkpoint: ]
- [ ] Task: Enhance "Row Details" Popup for Forensic Data
    -   Context: Modify `cli/src/ui.rs`.
    -   Sub-task: Refactor the detail popup to use a structured, multi-section layout (e.g., "Identifiers", "Permissions", "Activity", "Hygiene").
    -   Sub-task: Ensure long lists of secrets or permissions are readable (implement scrolling or better wrapping).
- [ ] Task: Implement Local Results Filtering
    -   Context: Modify `cli/src/app.rs` and `cli/src/ui.rs`.
    -   Sub-task: Add a search buffer and logic to filter the results table by App Name, User, or Severity.
- [ ] Task: Conductor - User Manual Verification 'TUI Detail View Refactor' (Protocol in workflow.md)

## Phase 3: Final Verification & Export [checkpoint: ]
- [ ] Task: Update CSV Export logic
    -   Context: Modify `cli/src/tui.rs` or `cli/src/app.rs`.
    -   Sub-task: Ensure all new forensic IDs and timestamps are included in the CSV export file.
- [ ] Task: End-to-End Forensic Audit Test
    -   Sub-task: Run the enriched audit on a test tenant and verify the "Row Details" contains >15 metadata fields as per spec.
- [ ] Task: Conductor - User Manual Verification 'Final Verification & Export' (Protocol in workflow.md)
