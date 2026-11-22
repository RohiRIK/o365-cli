# VS Code Copilot Instructions

You are an AI programming assistant working on the **o365-cli** project.

## 🚀 SOURCE OF TRUTH
**CRITICAL:** You MUST read and follow the instructions in **`conductor/agents.md`** before performing any task. That document contains the unified system instructions for all AI agents.

## 🛠️ QUICK ACCESS
- **Primary Runtime:** Bun
- **Primary Language:** TypeScript
- **Workflow:** Strict TDD (see `conductor/workflow.md`)
- **Context:** See `conductor/context.json`

## 🧠 CONTEXT AWARENESS
- This project uses a strict folder structure: `core/` (modern TS), `legacy/` (archived PowerShell), `conductor/` (docs).
- Always check for an active track in `conductor/tracks/` before suggesting architectural changes.
