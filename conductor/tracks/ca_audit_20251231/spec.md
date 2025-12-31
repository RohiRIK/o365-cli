# Specification: Conditional Access Policy Audit & Best Practice Analyzer

## 1. Overview
Create a new Security module (`sec:ca-audit`) that provides a comprehensive audit of Entra ID Conditional Access (CA) policies. This module goes beyond simple listing by offering deep visibility into policy configurations (assignments, conditions, controls), supporting advanced filtering, and performing an automated "Best Practice" gap analysis against Microsoft recommendations.

## 2. Functional Requirements

### 2.1 Policy Retrieval & Visualization
-   **Fetch Data:** Retrieve all Conditional Access policies using Microsoft Graph API (`/identity/conditionalAccess/policies`).
-   **Rich Table Output:** Display a detailed CLI table with the following columns:
    -   **Policy Identity:** Name, ID, State (Enabled/Disabled/Report-Only).
    -   **Assignments:** Included/Excluded Users, Groups, Roles.
    -   **Resources:** Target Cloud Apps.
    -   **Conditions:** Device Platforms, Locations, Client Apps, Risk Levels.
    -   **Controls:** Grant Controls (MFA, Compliant Device) and Session Controls.

### 2.2 Filtering & Search
-   **State Filter:** Filter policies by state (e.g., `--state enabled`).
-   **Target Filter:** Filter policies applying to a specific user or group (e.g., `--target user@domain.com`).

### 2.3 Best Practice Analysis (Baseline Check)
-   **Built-in Baseline:** Implement a hardcoded set of Microsoft-recommended checks, such as:
    -   MFA required for Global Administrators.
    -   Block Legacy Authentication.
    -   Require MFA for Azure Management.
    -   Block access from unknown/risky locations.
-   **Hybrid Configuration:** Allow users to override or extend this baseline via a local configuration file (optional flag `--config <path>`).
-   **Gap Reporting:** Highlight missing policies or dangerous configurations (e.g., "Critical: No MFA for Admins detected").

### 2.4 Export
-   **Export:** Support exporting the full, detailed dataset (including non-truncated fields) to CSV or JSON formats for offline analysis.

## 3. User Interface (CLI)
-   **Command:** `run sec:ca-audit [options]`
-   **Options:**
    -   `--analyze`: Trigger the best practice gap analysis.
    -   `--state <enabled|disabled|reportOnly>`: Filter by policy state.
    -   `--target <upn>`: Check coverage for a specific user.
    -   `--export <path>`: Save results to file.

## 4. Non-Functional Requirements
-   **Read-Only:** The module must strictly *read* policy data; no mutations allowed.
-   **Performance:** Efficiently handle tenants with 100+ policies using pagination if necessary.
