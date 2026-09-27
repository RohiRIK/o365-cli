# Specification: Update Conductor Documentation & Agent Context

## 1. Overview
The goal of this track is to consolidate the technology stack documentation and establish a unified "Agent Context" system. We will remove all references to Rust, explicitly enforce **Bun & TypeScript** as the *Primary* standard, but officially support **PowerShell** as a valid *Secondary* option for new scripts if preferred by the team. We will also create a centralized documentation entry point (`conductor/agents.md`) and machine-readable config (`conductor/context.json`) to ensure all AI agents (Claude, Gemini, Cursor, Windsurf, VS Code) share a single source of truth.

## 2. Functional Requirements

### 2.1 Stack Consolidation (Remove Rust, Enforce Bun/TS + PowerShell)
*   **Target Files:** `conductor/product.md`, `conductor/tech-stack.md`, `conductor/workflow.md`.
*   **Action:** Remove all references to Rust/Cargo.
*   **Action:** Update `tech-stack.md`:
    *   **Primary:** Define **Bun + TypeScript** as the default recommendation for complex logic and CLI structure.
    *   **Secondary:** Define **PowerShell** as a fully supported option for specific scripts or if the developer prefers it, provided it follows the project's directory structure.

### 2.2 Central Agent Documentation (`agents.md`)
*   **New File:** `conductor/agents.md`
*   **Content:** A high-level "System Instruction" for ANY AI agent. It should:
    *   Direct the agent to read `conductor/tech-stack.md` and `conductor/product.md` first.
    *   Summarize the "Bun First, PowerShell Supported" rule.
    *   Explain the directory structure.

### 2.3 Machine-Readable Context (`context.json`)
*   **New File:** `conductor/context.json`
*   **Content:** A JSON file containing:
    *   `project_name`: "o365-cli"
    *   `stack`: { "primary": "bun", "language": "typescript", "secondary": "powershell" }
    *   `paths`: Key directories (`core`, `conductor`, `legacy`).
    *   `doc_entry_point`: "conductor/agents.md"

### 2.4 Agent Configuration Updates
*   **Target Files:** `CLAUDE.md`, `GEMINI.md`
    *   **Action:** Update these to import/reference `conductor/agents.md` as their core instruction.
*   **New/Update:** Create/Update rules for **Cursor** (`.cursorrules`), **Windsurf** (`.windsurfrules` or equivalent), and **VS Code Copilot** to point to `conductor/agents.md`.

## 3. Non-Functional Requirements
*   **DRY (Don't Repeat Yourself):** Agent config files should be thin wrappers pointing to the central `conductor/` docs.
*   **Flexibility:** The structure must support both TS and PS1 files co-existing or living in their respective logical modules.

## 4. Out of Scope
*   Refactoring existing application code (logic changes).
