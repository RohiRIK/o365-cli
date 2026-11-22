# Track Specification: Shadow IT Forensic Enrichment

## Overview
Elevate the `sec:shadow-it` module from a high-level audit to a deep forensic analysis tool. This track enriches the report with granular identifiers, human-readable permission descriptions, detailed sign-in activity, and comprehensive certificate/secret hygiene data.

## Functional Requirements

### 1. Identifier Enrichment
- **Granular IDs:** Capture and expose the following for every flagged app:
    - **App ID:** The global application GUID.
    - **Service Principal ID:** The tenant-specific Object ID.
    - **Principal/User ID:** The Object ID of the consenting user or target.

### 2. Permission Deep-Dive
- **Human-Readable Scopes:** Resolve technical scope strings (e.g., `Files.Read.All`) into their official descriptions (e.g., "Read all files in all site collections").
- **Consent Attribution:** Explicitly label permissions as "Admin-consented" (App-only) or "User-consented" (Delegated).
- **Classification Source:** Indicate if a risk level is based on internal `HIGH_RISK_SCOPES` or Microsoft's official security classifications.

### 3. Sign-in Intelligence
- **Forensic Activity:** Include precise timestamps for the last successful sign-in to the specific app.
- **Interaction Mapping:** Distinguish between Interactive (user-driven) and Non-Interactive (service-driven) sign-in patterns.
- **Risk Indicators:** Flag apps with high failure rates or suspicious sign-in locations (if available via `signInActivity`).

### 4. Credential & Certificate Hygiene
- **Secret Inventory:** List all client secrets with their creation and expiration dates.
- **Certificate Audit:** Display X.509 certificate details, including Thumbprints and Issuer information.
- **Stale Credential Flagging:** Calculate "Credential Age" to identify keys that have not been rotated in accordance with enterprise policies.

## Technical Constraints
- **API Optimization:** Use the improved `fetchAll` and caching to handle the increased N+1 load required for descriptions and manager lookups.
- **TUI Updates:** Update the "Detail View" popup in `cli/src/ui.rs` to render the significantly larger set of forensic fields in a structured format.

## Acceptance Criteria
- The "Row Details" popup displays a comprehensive list of >15 metadata fields.
- All IDs (App, SP, User) are included in the CSV export.
- Secret expiration dates are visible for all analyzed service principals.

## Out of Scope
- Automated rotation of secrets (the module remains focused on governance and grant revocation).
