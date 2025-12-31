# Track Specification: Enterprise Production Readiness & Guest Lifecycle

## Overview
This track focuses on elevating the `o365-cli` from a functional prototype to an enterprise-grade governance platform. It addresses critical gaps in security, scalability, and safety while introducing the first major resource hygiene module: Guest User Lifecycle.

## Functional Requirements

### 1. Security & Authentication (Brain)
- **Encrypted Token Storage:** Refactor `auth.rs` to encrypt the `tokens.json` file using a machine-specific secret (e.g., derived from hardware UUID or a local key).
- **Session Resilience:** Enhance rotation logic to handle concurrent execution and file-system locking to prevent corruption.

### 2. Safety & Governance (UI/TUI)
- **Action Summary & Confirmation Flow:** 
    - For destructive tasks (e.g., `iam:offboard`), implement a "Review" state.
    - The TUI must trigger a silent dry-run, present a list of *proposed actions*, and require an explicit confirmation (e.g., `<Ctrl-X>`) before live execution.
- **Rich Results Navigation:**
    - Add a "Detail View" popup for the `sec:shadow-it` table to show full permission scopes and app details.
    - Implement local filtering (Search/Severity) for result tables.

### 3. Scalability & Resilience (Muscle)
- **Graph API Pagination:** Update `graph.ts` service to support automatic cursor-based pagination for all collection requests (Service Principals, Users, Guest Invites).
- **Throttling Handler:** Implement a global `Retry-After` interceptor to handle Graph API 429 errors gracefully.

### 4. New Module: Guest User Lifecycle (`iam:guest-cleanup`)
- **Port Logic:** Port existing PowerShell logic to TypeScript.
- **Features:** 
    - Identify stale guest accounts (last sign-in > 90 days).
    - Identify guests without assigned sponsors.
    - Provide remediation: Block sign-in or Remove guest.

## Technical Constraints
- **Encryption:** Use a standard Rust crate (e.g., `aes-gcm` or `secret-service` wrapper) for token encryption.
- **TUI Performance:** TUI must remain responsive while background pagination is fetching >1000 items.

## Acceptance Criteria
- Tokens in `tokens.json` are not human-readable.
- `iam:offboard` never executes live actions without a final confirmation screen.
- `sec:shadow-it` accurately reports data from tenants with >1000 registered applications.
- A new `iam:guest-cleanup` module is accessible from the IAM tab.

## Out of Scope
- Support for hardware security keys (YubiKey) for local encryption.
- Fully automated sponsorship outreach (emails/Teams).
