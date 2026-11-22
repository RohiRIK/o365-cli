# 🧑‍💻 o365-cli - Microsoft 365 Administration Toolset

A high-performance **TypeScript** platform powered by **Bun** for enterprise-grade Microsoft 365 administration.

## 🤖 AI AGENT INSTRUCTIONS
**CRITICAL:** All AI agents (Gemini, Claude, Cursor, Windsurf) MUST read and follow the instructions in **`conductor/agents.md`** before performing any task.

## 🚀 QUICK START

### Prerequisites
*   **Bun Runtime:** `brew install oven-sh/bun/bun` (macOS) or see [bun.sh](https://bun.sh)
*   **Permissions:** Global Administrator, User Administrator, or specific delegated permissions

### Running the CLI
```bash
# Install dependencies
cd core && bun install

# Run the interactive CLI
cd core && bun run src/cli.ts

# Run specific commands
cd core && bun run src/cli.ts run sec:shadow-it -- --dry-run true
```

## 🛡️ SAFETY GUIDELINES
**GOLDEN RULE: TEST BEFORE ACTION**
- **Dry-Run First**: All commands default to `--dry-run true`.
- **Verify with Tests**: Run `cd core && bun test` before committing any changes.

## 📊 CORE DOCUMENTATION
- **System Instructions:** `conductor/agents.md`
- **Tech Stack:** `conductor/tech-stack.md`
- **Implementation Workflow:** `conductor/workflow.md`
- **Project Context:** `conductor/context.json` (Machine-readable)

---
*See conductor/agents.md for the full agent context and TDD protocols.*
