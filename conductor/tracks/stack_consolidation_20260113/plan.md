# Plan: Update Conductor Documentation & Agent Context

This plan outlines the steps to consolidate the technology stack documentation, remove legacy references, and establish a centralized agent context for the o365-cli project.

## Phase 1: Stack Consolidation & Cleanup
Goal: Remove Rust references and standardize Bun/TypeScript and PowerShell in the core documentation.

- [x] Task: Remove Rust references from `conductor/product.md` (Already clean)
- [x] Task: Update `conductor/tech-stack.md` to define Bun + TypeScript as primary and PowerShell as secondary fa5359f
- [ ] Task: Update `conductor/workflow.md` examples to use `bun` commands
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Stack Consolidation & Cleanup' (Protocol in workflow.md)

## Phase 2: Agent Context & Integration
Goal: Create a centralized documentation entry point and machine-readable context for AI agents.

- [ ] Task: Create `conductor/agents.md` with system instructions for all agents
- [ ] Task: Create `conductor/context.json` with machine-readable project metadata
- [ ] Task: Update `CLAUDE.md` and `GEMINI.md` to point to `conductor/agents.md`
- [ ] Task: Document/Create `.cursorrules` and Windsurf-compatible instructions pointing to `conductor/agents.md`
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Agent Context & Integration' (Protocol in workflow.md)

## Phase 3: Tracks & Roadmap Alignment
Goal: Align the project roadmap with the new stack and clean up the tracks list.

- [ ] Task: Review and update `conductor/tracks.md` to remove or pivot any Rust-specific tracks
- [ ] Task: Perform a general audit of `conductor/` directory for any lingering "legacy" terminology
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Tracks & Roadmap Alignment' (Protocol in workflow.md)
