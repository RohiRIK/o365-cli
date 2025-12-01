# IT Administration & Automation Scripts

This repository contains a collection of PowerShell scripts designed for Microsoft 365 and Entra ID (formerly Azure AD) administration. These tools automate common tasks such as employee offboarding, stale device cleanup, guest user lifecycle management, and shadow IT governance.

## Prerequisites

Before running these scripts, ensure your environment meets the following requirements:

*   **PowerShell:** PowerShell 5.1 or PowerShell 7+ (Core) is recommended.
*   **Modules:** The scripts rely heavily on the Microsoft Graph and Exchange Online PowerShell modules.
    ```powershell
    Install-Module Microsoft.Graph -Scope CurrentUser
    Install-Module ExchangeOnlineManagement -Scope CurrentUser
    ```
*   **Permissions:** You will need appropriate administrative roles (e.g., Global Administrator, User Administrator, Exchange Administrator, Intune Administrator) to execute these actions.

## Scripts Overview

| Script File | Description | Key Features |
| :--- | :--- | :--- |
| `Invoke-Employee360_Report.ps1` | **360° Offboarding Analyzer**<br>Generates a forensic report on user activity, licenses, devices, and group memberships to aid in offboarding decisions. | • detailed user activity scanning<br>• License & Device inventory<br>• Export to CSV |
| `Invoke-GracefulOffboarding.ps1` | **Standard Offboarding Automation**<br>Executes the "Graceful Exit" protocol for terminations, focusing on data preservation and license optimization. | • Blocks sign-in<br>• Converts to Shared Mailbox<br>• Hides from GAL<br>• Grants Manager access<br>• Reclaims licenses |
| `Invoke-GuestCleanup.ps1` | **Guest User Lifecycle Management**<br>Identifies and cleans up stale guest users. Includes logic to handover assets to a sponsor/manager before deletion. | • Manager/Sponsor detection<br>• Asset handover (Mailbox/OneDrive)<br>• Webhook integration (e.g., for n8n/Zapier) for orphaned users |
| `Invoke-StaleDeviceCleanup.ps1` | **Smart Device Cleanup**<br>Removes stale devices from Entra ID based on inactivity and registration type. | • Aware of Registration Type (TrustType)<br>• Protects Hybrid Joined devices<br>• Autopilot/Kiosk protection logic |
| `ShadowITCleanup.ps1` | **Shadow IT Governance**<br>Scans for and remediates risky OAuth applications granted by users (Shadow IT). | • Risk scoring based on scopes (e.g., Mail.Read)<br>• White-listing capabilities<br>• Auto-remediation & User notification |

## Usage Guidelines

**GOLDEN RULE: TEST BEFORE ACTION**
> We NEVER move forward until we verify the script. When instructed to 'test', I (the agent) will execute the PowerShell script using `pwsh -File <script.ps1>`. I will analyze the output for logs and syntax errors and fix those on the way. I will *never* change the script's core functionality without explicit user confirmation.
> Remember: Scripts often include a `-DryRun` parameter (defaulting to `$true`) for simulation. Only after successful verification in Dry Run mode do we proceed with real action (`-DryRun $false`).
> Also, you (the user) are still responsible for executing the scripts and providing their output for review, especially for interactive authentication or complex environment setups.

Most scripts include a `-DryRun` parameter which is set to `$true` by default. This ensures that running a script without arguments will only simulate the actions and print what *would* happen.

**Local Context:** Each script folder contains a `GEMINI.md` file with specific context and instructions for that module. Refer to it for detailed operational logic. If a folder is missing this file, you (the agent) must create it.

### 1. Employee Offboarding Reporting
Generate a report to decide how to handle inactive users.
```powershell
.\Invoke-Employee360_Report.ps1 -ReportPath ".\OffboardingReport.csv"
```

### 2. Graceful Offboarding
Perform the actual offboarding for a user.
```powershell
.\Invoke-GracefulOffboarding.ps1 -UserPrincipalName "jdoe@company.com" -ManagerEmail "manager@company.com" -DryRun $false
```

### 3. Guest Cleanup
Run a cleanup of guest users, notifying a webhook if manual intervention is needed for orphans.
```powershell
.\Invoke-GuestCleanup.ps1 -WebhookUrl "https://your-webhook-url" -DryRun $false
```

### 4. Stale Device Cleanup
Clean up old BYOD devices (Workplace joined) but leave Hybrid devices alone.
```powershell
.\Invoke-StaleDeviceCleanup.ps1 -TargetTrustType "Workplace" -DryRun $false
```

### 5. Shadow IT Governance
Audit risky applications without taking action.
```powershell
.\ShadowITCleanup.ps1 -DryRun $true
```

## Safety & Logging
*   **Dry Run:** Always run with `-DryRun $true` (or default) first to verify the scope of changes.
*   **Logging:** Scripts output to the console using `Write-Host` with color-coding for readability. Some scripts generate CSV reports.
