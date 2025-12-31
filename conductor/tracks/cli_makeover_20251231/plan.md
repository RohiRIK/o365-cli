# Track Plan: CLI Pro Makeover & Navigation System

## Phase 1: Core Foundation & Signal Handling
- [x] Task: Install New Dependencies (745b2fc)
    - Context: `package.json`.
    - Sub-task: Install `boxen`, `@inquirer/search`, and `@inquirer/type` to support the new UI and search functionality.
- [x] Task: Initialize Navigation Service & Design System (29bb331)
    - Context: Create `core/src/services/navigation.ts` and `core/src/utils/theme.ts`.
    - Sub-task: Write unit tests for `NavigationService` (breadcrumb state tracking).
    - Sub-task: Implement `Theme` utility with Violet (#8b5cf6) and Zinc hex codes.
- [ ] Task: Implement Graceful Shutdown & Cursor Management
    - Context: Update `core/src/cli.ts` or a new process utility.
    - Sub-task: Implement SIGINT (Ctrl+C) interception to restore terminal state and exit cleanly.
- [ ] Task: Conductor - User Manual Verification 'Core Foundation' (Protocol in workflow.md)

## Phase 2: Dynamic UI Components
- [ ] Task: Implement Styled Boxen Header & Breadcrumbs
    - Context: `core/src/services/navigation.ts`.
    - Sub-task: Write tests for breadcrumb visual hierarchy logic (muted history vs highlighted current).
    - Sub-task: Implement header rendering using `boxen` and the Navigation Service state.
- [ ] Task: Implement Screen Management Logic
    - Sub-task: Integrate mandatory console clearing into the Navigation transition lifecycle.
- [ ] Task: Conductor - User Manual Verification 'Dynamic UI Components' (Protocol in workflow.md)

## Phase 3: Searchable Discovery
- [ ] Task: Implement Autocomplete Module Picker
    - Context: Replace `select` with `@inquirer/search` in `core/src/cli.ts`.
    - Sub-task: Write tests for module search/filter logic.
    - Sub-task: Implement searchable list with human-readable titles and technical ID descriptions.
- [ ] Task: Implement Zero-Result UI State
    - Sub-task: Add styled "No results found" feedback for the search interface.
- [ ] Task: Conductor - User Manual Verification 'Searchable Discovery' (Protocol in workflow.md)

## Phase 4: Global Orchestration Integration
- [ ] Task: Refactor Interactive Menus to Navigation Service
    - Context: Migration of `showInteractiveMenu` and `runModuleSelector` in `core/src/cli.ts`.
    - Sub-task: Replace manual header prints and `console.clear()` calls with Service-driven calls.
- [ ] Task: Final Polish & UX Audit
    - Sub-task: Verify consistent application of the "Violet & Zinc" theme across all system settings and tasks.
- [ ] Task: Conductor - User Manual Verification 'Global Orchestration' (Protocol in workflow.md)
