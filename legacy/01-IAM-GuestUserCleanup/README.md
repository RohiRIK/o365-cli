# Guest User Lifecycle Cleanup Tool

This PowerShell script, `Invoke-GuestCleanup_Action.ps1`, is a comprehensive governance tool for managing the lifecycle of external Guest users in Microsoft Entra ID (Azure AD). It automates the detection and removal of stale guest accounts while ensuring critical assets are not lost.

## Workflow

The script follows a "Safe Cleanup" protocol:

1.  **Scan & Whitelist:** Scans all Guest users and skips those from excluded domains (e.g., `partner.com`).
2.  **Staleness Check:** Calculates inactivity based on `LastSignInDateTime` or `CreatedDateTime`.
    *   **Disable Phase:** If inactive > `DaysToDisable` (default 90), the account is disabled.
    *   **Delete Phase:** If inactive > `DaysToDelete` (default 180), the account is queued for deletion.
3.  **Asset Handover (Pre-Delete):**
    *   Checks if the guest has a **Manager** assigned in Entra ID.
    *   **If Manager Exists:** Grants the manager Full Access to the guest's mailbox (if one exists) to preserve data.
    *   **If Orphaned (No Manager):** Triggers a **Webhook** (e.g., to ServiceNow, Jira, n8n) to alert IT for manual intervention.
4.  **Execution:** Performs the Disable or Delete action (unless in Simulation mode).

## Prerequisites

*   **PowerShell 7+ (Core):** Recommended.
*   **Microsoft Graph PowerShell Module:**
    ```powershell
    Install-Module Microsoft.Graph -Scope CurrentUser
    ```
*   **Permissions:** The running account needs:
    *   `User.ReadWrite.All` (to disable/delete users)
    *   `User.Read.All` (to scan users)
    *   `Directory.Read.All` (to read managers)
    *   `AuditLog.Read.All` (to read sign-in activity)

## Usage

Run the script from a PowerShell console.

```powershell
.\GuestCleanup_Script\Invoke-GuestCleanup_Action.ps1
```

### Parameters

*   `-ExecuteLive` (switch):
    *   If **Omitted** (Default): Runs in **SIMULATION MODE**. Logs what would happen.
    *   If **Included** (`-ExecuteLive`): **EXECUTES** the disable/delete actions.
*   `-DaysToDisable` (int): Days inactive before disabling. Default: `90`.
*   `-DaysToDelete` (int): Days inactive before deletion. Default: `180`.
*   `-ExcludedDomains` (string[]): Domains to ignore. Default: `@("gmail.com", "partner.com")`.
*   `-WebhookUrl` (string): Optional URL to trigger for orphaned users (no manager).

### Examples

**1. Audit (Simulation)**
Check for stale guests.
```powershell
.\GuestCleanup_Script\Invoke-GuestCleanup_Action.ps1
```

**2. Live Cleanup with Webhook**
Clean up guests and notify a webhook for orphans.
```powershell
.\GuestCleanup_Script\Invoke-GuestCleanup_Action.ps1 -ExecuteLive -WebhookUrl "https://api.my-it-system.com/guest-orphan"
```

## Safety Features

*   **Simulation Default:** Always runs in simulation mode unless `-ExecuteLive` is explicitly passed.
*   **Manager Check:** Never deletes a user without checking for a manager first.
*   **Whitelist:** Protects specific partner domains from automated cleanup.
