# Product Guidelines: o365-cli

## Prose & Communication Tone
-   **Professional & Technical:** All documentation, logs, and user-facing messages must be direct, precise, and objective. Avoid conversational filler; focus on providing actionable technical information.
-   **Operational First:** Prioritize clear, concise instructions for administrators. Documentation should lead with "how to use" and "what this does" before diving into underlying architecture.

## Visual Identity (TUI)
-   **Modern & Rich:** Leverage the full capabilities of modern terminals. Use high-contrast colors, borders, and Unicode icons (e.g., 🛡️, 🚀, ✅, ⚠️) to categorize information and enhance readability.
-   **Structured Layout:** Use distinct panels and tables to separate logs, results, and navigation elements.

## Language & Formatting
-   **US English:** Adhere to US English spelling conventions (e.g., "Color", "Initialize", "Center").
-   **Consistent Formatting:** Follow established Markdown patterns for documentation, ensuring a uniform look across all module READMEs and research docs.

## Branding & Naming Conventions
-   **Standardized Prefixing:** All modules and commands must be categorized using the established strategic pillars:
    -   `iam:` (Identity & Access Management)
    -   `sec:` (Security & Threat Containment)
    -   `gov:` (Governance & Compliance)
    -   `end:` (Endpoint & Device Management)
    -   `res:` (Resource Management)
    -   `rep:` (Deep Reporting)
-   **Identifier Case:** Use `kebab-case` for all command and module identifiers (e.g., `sec:shadow-it`).