# Specification: Conditional Access Governance Suite

## 1. Overview
Instead of a single tool, this track now delivers a dual-module suite for Conditional Access (CA) governance:
1.  **Technical Audit (`sec:ca-audit`)**: A deep-dive module for admins to list, filter, and export every policy detail.
2.  **Strategic Roadmap (`rep:ca-roadmap`)**: An executive-level module that performs gap analysis against Microsoft Best Practices and generates a prioritized 3-phase implementation roadmap.

## 2. Functional Requirements

### 2.1 [Module] Technical Audit (`sec:ca-audit`)
-   **Goal**: Comprehensive visibility and data portability.
-   **Output**: Rich CLI table with compact summaries (Users: 1, Groups: 2).
-   **Export**: Flattened CSV with full ID-to-Name resolution (UPNs and App Names).
-   **Filtering**: Support for `--state` and `--target` (user/group).

### 2.2 [Module] Strategic Roadmap (`rep:ca-roadmap`)
-   **Goal**: Gap analysis and security planning.
-   **Engine**: Uses the `CABaselineAnalyzer` to check for:
    -   Legacy Auth Blocking
    -   Admin/Guest MFA
    -   Individual Break-Glass exclusions
    -   Zero Trust signals (Device Compliance & Risk)
-   **Output**: 
    -   **Gap Analysis Table**: Status (PASS/FAIL) and specific recommendations.
    -   **Prioritized Roadmap**: 3-Phase plan (Foundation, Surface Reduction, Zero Trust Maturity).

## 3. User Interface (CLI)
-   `run sec:ca-audit`: Shows the technical table.
-   `run rep:ca-roadmap`: Shows the gap analysis and roadmap.

## 4. Non-Functional Requirements
-   **Shared Foundation**: Both modules share the same `fetchCAPolicies` logic and `CABaselineAnalyzer` service.
-   **Read-Only**: Strictly audit-focused; no configuration changes.