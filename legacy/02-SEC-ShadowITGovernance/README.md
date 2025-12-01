# Shadow IT Governance Tool

This PowerShell script, `Invoke-ShadowIT_Report.ps1` (formerly `ShadowITCleanup.ps1`), is a governance tool designed to detect, report, and optionally remediate "Shadow IT" within your Microsoft Entra ID (Azure AD) environment.

## Overview

"Shadow IT" refers to third-party applications that users grant access to their corporate data (via OAuth consents) without explicit IT approval. While often done for productivity, these apps can pose significant security risks if they request sensitive permissions like `Mail.Read` or `Files.Read.All`.

This tool scans all OAuth grants in your tenant, identifies risky applications based on the permissions they hold, and provides a detailed forensic report.

## Key Features

*   **Risk Scoring:** Automatically flags apps requesting high-risk scopes (e.g., `Mail.Read`, `Files.Read`, `Directory.ReadWrite.All`).
*   **Data Enrichment:** Pulls detailed metadata for both the App (Publisher, Homepage, Reply URLs, Secret Status) and the User (Job Title, Department, Manager).
*   **Dormant Grant Detection:** (Implied) By correlating with user `LastSignIn`, you can identify if risky apps are connected to inactive accounts.
*   **Whitelist Capability:** built-in logic to skip known/safe apps (e.g., Zoom, Slack) or specific App IDs.
*   **Remediation Mode:** Can be run to automatically **revoke** the permissions of identified risky apps.
*   **User Notification:** Optionally sends an email to the user explaining why an app connection was removed.

## Prerequisites

*   **PowerShell 7+ (Core):** Recommended.
*   **Microsoft Graph PowerShell Module:**
    ```powershell
    Install-Module Microsoft.Graph -Scope CurrentUser
    ```
*   **Permissions:** The running account requires:
    *   `DelegatedPermissionGrant.ReadWrite.All`
    *   `Application.Read.All`
    *   `User.Read.All`
    *   `Directory.Read.All`
    *   `AuditLog.Read.All`
    *   `Mail.Send` (only if using `-NotifyUser`)

## Usage

Run the script from a PowerShell console.

```powershell
.\ShadowIT_Script\Invoke-ShadowIT_Report.ps1
```

### Parameters

*   `-DryRun` (default: `$true`): If `$true`, the script only generates a CSV report. If `$false`, it **Revokes** permissions if `-RemediationMode` is also set.
*   `-RemediationMode` (default: `$false`): Safety switch. Must be set to `$true` explicitly to allow permission revocation.
*   `-NotifyUser` (default: `$false`): If `$true`, sends an email to the user upon revocation.
*   `-ReportPath`: Path to save the CSV report (default: `.\ShadowIT_Report.csv`).

### Examples

**1. Audit Only (Default)**
Generate a report of all risky apps without taking action.
```powershell
.\ShadowIT_Script\Invoke-ShadowIT_Report.ps1
```

**2. Revoke Risky Apps**
Revoke permissions for all identified risky apps (Dangerous! Use with caution).
```powershell
.\ShadowIT_Script\Invoke-ShadowIT_Report.ps1 -DryRun $false -RemediationMode $true
```

**3. Revoke and Notify**
Revoke permissions and email the user.
```powershell
.\ShadowIT_Script\Invoke-ShadowIT_Report.ps1 -DryRun $false -RemediationMode $true -NotifyUser $true
```

## Report Output (`ShadowIT_Report.csv`)

The generated CSV contains detailed columns including:

*   **App Details:** `AppName`, `AppId`, `Publisher`, `VerifiedPub`, `Homepage`, `ReplyUrls`.
*   **Risk Factors:** `RiskyScopes` (the specific dangerous permissions), `AllScopes`.
*   **Security Context:** `SecretStatus`, `CertStatus` (validity of the app's credentials).
*   **User Context:** `UserUPN`, `UserDisplayName`, `JobTitle`, `Department`, `Manager`, `LastSignIn`.
*   **Grant Info:** `GrantStart`, `GrantExpiry`.
*   **Action:** Whether the grant was "Audit Only" or "Revoked".
