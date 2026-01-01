# Implementation Plan - Conditional Access Governance Suite

## Phase 1: Core Logic & Data Retrieval [checkpoint: 9e381ae]
- [x] Task: Scaffold CA Audit Module Structure (3acb0a0)
- [x] Task: Implement CA Policy Fetching (TDD) (d389152)
- [x] Task: Conductor - User Manual Verification 'Core Logic' (Protocol in workflow.md)

## Phase 2: Visualization & Filtering [checkpoint: 2dbca25]
- [x] Task: Implement Data Normalization for Display (TDD) (3d5747a)
- [x] Task: Implement Table Rendering & Filtering (TDD) (d7cf532)
- [x] Task: CLI UX Refinement (Categories & run dev) (a8c58c7)
- [x] Task: Conductor - User Manual Verification 'Visualization' (Protocol in workflow.md)

## Phase 3: Best Practice Engine [checkpoint: d17a24f]
- [x] Task: Implement Baseline Analyzer (TDD) (d70f8bf)
- [x] Task: Integrate Analysis into CLI Output (5ba2c58)
- [x] Task: Conductor - User Manual Verification 'Best Practice Engine' (Protocol in workflow.md)

## Phase 4: Strategic Roadmap Module [checkpoint: 032f9c4]
- [x] Task: Create Strategic Roadmap Module (`rep:ca-roadmap`)
    - Context: Create `core/src/handlers/rep/ca-roadmap.ts`.
    - Sub-task: Port the `CABaselineAnalyzer` integration to the new module.
    - Sub-task: Refactor `sec:ca-audit` to remove analysis logic (moving it to the separate module).
- [x] Task: Implement Multi-Module Data Export
    - Sub-task: Ensure both modules correctly support the CSV export of their respective datasets.
- [x] Task: Final UX Polish & Registry Cleanup
    - Sub-task: Ensure both modules have high-quality names and descriptions in the `list` output.
- [x] Task: Conductor - User Manual Verification 'Strategic Roadmap' (Protocol in workflow.md)

## Phase 5: High-Fidelity Analysis Engine [checkpoint: 8642da5]

- [x] Task: Implement Effective App Coverage Logic (5b3a114)

    - Context: `core/src/services/analyzer/ca-baseline.ts`.

    - Sub-task: Update checks to detect if "All Apps" covers specific requirements (e.g., Admin Portals).

- [x] Task: Implement "Partial Match" (Warning) State (5b3a114)

    - Sub-task: Add a "warn" status for policies that meet criteria but are in "Report-Only" mode.

- [x] Task: Migrate to TypeScript Modular Check System (6a070e2)

    - Sub-task: Create individual TypeScript modules for each check with co-located metadata and detection logic.
    - Sub-task: Implement CheckHelpers interface and expose helper methods to check modules.
    - Sub-task: Update analyzer to use getAllChecks() registry pattern.

- [x] Task: Expand Baseline Coverage to 27 Checks (8642da5)

    - Sub-task: Add 12 new baseline checks across all pillars (Foundation, Risk-Based, Zero Trust, Administration).
    - Sub-task: Each check includes rich context, implementation guides, Graph API examples, and references.

- [ ] Task: Advanced MAM & Device Detection

    - Sub-task: Refine MAM detection to handle "All Platforms" with mobile-specific grant controls.

- [x] Task: Grant Control "Effective Logic" (OR/AND) (6a070e2)

    - Sub-task: Implement logic to parse `grantControls.operator` for complex control groups.

- [x] Task: Strategic Roadmap "Reasoning" Engine (8642da5)

    - Sub-task: For each check, provide detailed "Why it matters", "Implementation Steps", and Microsoft references.

- [ ] Task: Conductor - User Manual Verification 'High-Fidelity Engine' (Protocol in workflow.md)


