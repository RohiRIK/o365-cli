# License Optimization Module

## Context
This folder contains tools for analyzing Microsoft 365 license usage, financial waste, and potential optimizations.

## Scripts
*   **`Invoke-LicenseOptimization_Report.ps1`**: The primary engine.
    *   **Type:** Reporting / Read-Only (No Write Action).
    *   **Input:** Connects to MS Graph to fetch Users, SubscribedSkus, and SignInActivity.
    *   **Output:**
        *   `LicenseOptimization_Report.csv`: Detailed user-level audit.
        *   `LicenseOptimization_RemediationInput.csv`: Remediation actions for bulk processing.
        *   `LicenseOptimization_Dashboard.html`: Executive summary.

## Key Logic
1.  **Zombie Detection:** Users with `AccountEnabled = $false` but assigned licenses.
2.  **Redundancy:** Checks for overlapping SKUs (e.g., E5 Suite + PowerBI Pro Standalone).
3.  **Inactivity:**
    *   **Inactive:** Enabled users, last sign-in > 60 days.
    *   **Ghost:** Enabled users, created > 30 days ago, *never* signed in.

## Operational Rules
*   **Dry Run:** This script is **ReadOnly**. Running it *is* the dry run for remediation. It does not modify the tenant.
*   **Cost Map:** Defaults are hardcoded but can be overridden via parameters.
