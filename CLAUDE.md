# CLAUDE.md - Claude Code Instructions

This file provides the primary entry point for Claude Code (claude.ai/code).

## 🚀 SOURCE OF TRUTH
**CRITICAL:** You MUST read and follow the instructions in **`conductor/agents.md`** before performing any task. That document contains the unified system instructions for all AI agents, including core technology standards (Bun/TypeScript), directory structure, and the TDD workflow.

## 🛠️ QUICK ACCESS
- **Primary Runtime:** Bun
- **Primary Language:** TypeScript
- **Context Config:** `conductor/context.json` (Machine-readable metadata)
- **Workflow:** `conductor/workflow.md` (Strict TDD implementation lifecycle)

## 🧪 COMMON COMMANDS
```bash
# Install dependencies
cd core && bun install

# Run tests
cd core && bun test

# Run interactive CLI
cd core && bun run src/cli.ts
```

---
*Refer to conductor/agents.md for full context.*