# Shadow IT Governance Module

## Context
This folder contains tools for detecting and remediating "Shadow IT" - specifically, third-party applications that users have granted OAuth permissions to (e.g., "Read my Mail," "Access my Files") without IT oversight.

## Scripts
*   **`Invoke-ShadowIT_Report.ps1`**: The core scanner and enforcer.
    *   **Type:** Audit / Action (Configurable).
    *   **Input:** Configurable "Risky Scopes" and "Whitelisted Apps".
    *   **Output:** CSV Report, Remediation (Revocation), User Notification.

## Key Logic
1.  **Scan Grants:** Iterates through all `OAuth2PermissionGrants` in the tenant.
2.  **Filters:**
    *   Ignores Microsoft's own apps (First-party).
    *   Ignores explicitly Whitelisted App IDs (e.g., approved enterprise tools like Zoom, Slack).
3.  **Risk Assessment:** Flags any app requesting high-risk scopes defined in `$HighRiskScopes` (e.g., `Mail.Read`, `Files.Read.All`, `Directory.ReadWrite.All`).
4.  **User Enrichment:** Fetches details about the user who granted consent (Department, Manager, LastSignIn) to help decide if the grant is legitimate.
5.  **Action (If `-DryRun $false`):**
    *   **Revoke:** Removes the permission grant.
    *   **Notify:** Optionally emails the user explaining the action.

## Operational Rules
*   **Simulation Default:** Uses `-DryRun` parameter. Defaults to `$true`.
*   **Safe Mode:** By default, it does *not* remediate. You must explicitly set `-RemediationMode $true` AND `-DryRun $false` to take action.
*   **Dependencies:** `Microsoft.Graph` (Applications, Users, Mail).
