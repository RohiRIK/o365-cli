# Plan: Update Conductor Documentation & Agent Context

This plan outlines the steps to consolidate the technology stack documentation, remove legacy references, and establish a centralized agent context for the o365-cli project.

## Phase 1: Stack Consolidation & Cleanup [checkpoint: cfd6d35]
Goal: Remove Rust references and standardize Bun/TypeScript and PowerShell in the core documentation.

- [x] Task: Remove Rust references from `conductor/product.md` (Already clean)
- [x] Task: Update `conductor/tech-stack.md` to define Bun + TypeScript as primary and PowerShell as secondary fa5359f
- [x] Task: Update `conductor/workflow.md` examples to use `bun` commands 09f78fe
- [x] Task: Conductor - User Manual Verification 'Phase 1: Stack Consolidation & Cleanup' (Protocol in workflow.md)

## Phase 2: Agent Context & Integration [checkpoint: 1ef03ea]
Goal: Create a centralized documentation entry point and machine-readable context for AI agents.

- [x] Task: Create `conductor/agents.md` with system instructions for all agents 307ca30
- [x] Task: Create `conductor/context.json` with machine-readable project metadata 15d4bcf
- [x] Task: Update `CLAUDE.md` and `GEMINI.md` to point to `conductor/agents.md` fe20dbc
- [x] Task: Document/Create `.cursorrules` and Windsurf-compatible instructions pointing to `conductor/agents.md` ff16868
- [x] Task: Update `.github/copilot-instructions.md` to point to `conductor/agents.md` 8772fe0
- [x] Task: Conductor - User Manual Verification 'Phase 2: Agent Context & Integration' (Protocol in workflow.md)

## Phase 3: Tracks & Roadmap Alignment
Goal: Align the project roadmap with the new stack and clean up the tracks list.

- [ ] Task: Review and update `conductor/tracks.md` to remove or pivot any Rust-specific tracks
- [ ] Task: Perform a general audit of `conductor/` directory for any lingering "legacy" terminology
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Tracks & Roadmap Alignment' (Protocol in workflow.md)
