# Plan: Agent Context Helper Scripts

This plan outlines the creation of "sourceable" helper scripts for Bash/Zsh and PowerShell to allow dynamic retrieval of project context.

## Phase 1: Script Implementation & Documentation
Goal: Create the shell helper scripts and document their usage.

- [x] Task: Create `scripts/setup-env.sh` (Bash/Zsh) c9a13b6
    - Sub-task: Implement `get-context`, `project-root`, and `run-cli` functions.
- [ ] Task: Create `scripts/Setup-Env.ps1` (PowerShell)
    - Sub-task: Implement `Get-Context`, `Go-Root`, and `Run-Cli` functions.
- [ ] Task: Update `conductor/agents.md` with usage instructions for these scripts.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Script Implementation & Documentation' (Protocol in workflow.md)
