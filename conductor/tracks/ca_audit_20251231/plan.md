# Implementation Plan - Conditional Access Audit

## Phase 1: Core Logic & Data Retrieval [checkpoint: 9e381ae]
- [x] Task: Scaffold CA Audit Module Structure (3acb0a0)
    - Context: `core/src/handlers/sec/ca-audit.ts` and register it in `core/src/handlers/registry.ts`.
    - Sub-task: Define the `TaskHandler` interface for `sec:ca-audit`.
- [x] Task: Implement CA Policy Fetching (TDD) (d389152)
    - Context: `core/src/services/graph.ts` (if needed) or within the handler.
    - Sub-task: Write tests for fetching and type-guarding CA policy objects from Graph API.
    - Sub-task: Implement the Graph call `GET /identity/conditionalAccess/policies`.
- [x] Task: Conductor - User Manual Verification 'Core Logic' (Protocol in workflow.md)

## Phase 2: Visualization & Filtering [checkpoint: 2dbca25]
- [x] Task: Implement Data Normalization for Display (TDD) (3d5747a)
    - Context: `core/src/commands/sec/ca-audit.ts`.
    - Sub-task: Write tests for converting complex nested Graph objects (Conditions, Grants) into readable string summaries for the table.
    - Sub-task: Implement the normalization helpers.
- [x] Task: Implement Table Rendering & Filtering (TDD) (d7cf532)
    - Sub-task: Write tests for filtering logic (by State, by Target User - mock logic).
    - Sub-task: Implement the table display using `cli-table3` and filtering flag logic.
- [x] Task: CLI UX Refinement (Categories & run dev) (a8c58c7)
    - Sub-task: Restore categorized module selection.
    - Sub-task: Support `run dev` to filter for Beta/Draft modules.
- [x] Task: Conductor - User Manual Verification 'Visualization' (Protocol in workflow.md)

## Phase 3: Best Practice Engine
- [x] Task: Implement Baseline Analyzer (TDD) (d70f8bf)
    - Context: `core/src/services/analyzer/ca-baseline.ts` (new service).
    - Sub-task: Write tests for the analyzer engine (passing vs failing policies).
    - Sub-task: Implement the hardcoded Microsoft Best Practice checks (MFA for Admins, Legacy Auth Block).
- [ ] Task: Implement Hybrid Config Loader (TDD)
    - Sub-task: Write tests for loading and merging custom JSON/YAML baselines with defaults.
    - Sub-task: Implement the configuration loader.
- [ ] Task: Integrate Analysis into CLI Output
    - Sub-task: Update the CLI command to run the analyzer when `--analyze` is passed and display gap reports.
- [ ] Task: Conductor - User Manual Verification 'Best Practice Engine' (Protocol in workflow.md)

## Phase 4: Export & Integration
- [ ] Task: Implement Export Functionality
    - Sub-task: Implement CSV/JSON export logic for the full dataset.
- [ ] Task: Final Polish & Registration
    - Sub-task: Ensure help text and argument parsing matches the spec.
    - Sub-task: Verify "Violet & Zinc" theme consistency.
- [ ] Task: Conductor - User Manual Verification 'Final Release' (Protocol in workflow.md)
