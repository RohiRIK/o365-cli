# Implementation Plan - Conditional Access Audit

## Phase 1: Core Logic & Data Retrieval
- [ ] Task: Scaffold CA Audit Module Structure
    - Context: Create `core/src/handlers/sec/ca-audit.ts` and register it in `core/src/handlers/registry.ts`.
    - Sub-task: Define the `TaskHandler` interface for `sec:ca-audit`.
- [ ] Task: Implement CA Policy Fetching (TDD)
    - Context: `core/src/services/graph.ts` (if needed) or within the handler.
    - Sub-task: Write tests for fetching and type-guarding CA policy objects from Graph API.
    - Sub-task: Implement the Graph call `GET /identity/conditionalAccess/policies`.
- [ ] Task: Conductor - User Manual Verification 'Core Logic' (Protocol in workflow.md)

## Phase 2: Visualization & Filtering
- [ ] Task: Implement Data Normalization for Display (TDD)
    - Context: `core/src/commands/sec/ca-audit.ts`.
    - Sub-task: Write tests for converting complex nested Graph objects (Conditions, Grants) into readable string summaries for the table.
    - Sub-task: Implement the normalization helpers.
- [ ] Task: Implement Table Rendering & Filtering (TDD)
    - Sub-task: Write tests for filtering logic (by State, by Target User - mock logic).
    - Sub-task: Implement the table display using `cli-table3` and filtering flag logic.
- [ ] Task: Conductor - User Manual Verification 'Visualization' (Protocol in workflow.md)

## Phase 3: Best Practice Engine
- [ ] Task: Implement Baseline Analyzer (TDD)
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
