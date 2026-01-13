# Track Specification: CLI Pro Makeover & Navigation System

## Overview
Transform the `o365-cli` from a standard command-line interface into a professional, high-signal "Orchestrator" experience. This track implements a centralized navigation system, a dynamic "Breadcrumb" header, a "Violet & Zinc" design system, and robust terminal management.

## Functional Requirements

### 1. Navigation & Header System
- **Centralized Navigation Service:** Implement a service to track the user's location in the menu hierarchy and handle header rendering.
- **Dynamic Headers:** Use the `boxen` library to render a consistent, styled top banner for every screen.
- **Breadcrumb Logic:** Display a "⚡ Breadcrumb" path (e.g., `Control Center › Run a Module › Security`) with a visual hierarchy (highlighted current location, muted history).
- **Screen Refresh Policy:** The service must trigger a console clear before rendering a new state, ensuring the header is always anchored at the absolute top of the terminal.

### 2. Visual Design System (Violet & Zinc)
- **Primary Theme:** Implement Violet (#8b5cf6) for active selections, icons, and focus elements.
- **Secondary/Muted Theme:** Use Zinc-400/600 for descriptions, separators, and breadcrumb history.
- **Muted "Back" Navigation:** Standardize "Go Back" options with muted styling to de-emphasize them relative to primary tasks.

### 3. Searchable Discovery
- **Autocomplete Module Selection:** Replace standard selection lists with searchable autocomplete menus for the module picker.
- **Zero-Result Handling:** Display a helpful, styled message (in Muted Zinc) when a search yields no matches.
- **Human-Readable Titles:** Display friendly titles for modules while moving technical IDs (e.g., `dev:intune-audit`) to the description field.

## Technical Implementation
- **Library:** Continue using `@inquirer/prompts` and integrate `@inquirer/search` for autocomplete functionality.
- **Styling:** Use `chalk` for hex-code color mapping and `boxen` for framing.
- **Graceful Shutdown:** Intercept termination signals (Ctrl+C) to restore the terminal cursor and exit cleanly without printing stack traces.

## Acceptance Criteria
- [ ] Screen clears entirely between transitions so the Boxen header always anchors to the top.
- [ ] Breadcrumbs correctly update as the user drills down into categories and modules.
- [ ] Module selection allows real-time typing to filter results with helpful "No results" states.
- [ ] The "Violet & Zinc" color palette is applied consistently across all menus.
- [ ] Ctrl+C anywhere in the app triggers a clean, styled exit (no stack traces).
- [ ] Terminal Cursor is managed correctly (hidden during interaction, restored on exit).
