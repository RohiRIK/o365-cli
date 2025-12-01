# Graceful Offboarding Action Tool

This PowerShell script, `Invoke-GracefulOffboarding_Action.ps1`, automates the standard "soft" offboarding process for employee terminations. Unlike emergency lockdowns, this workflow focuses on data preservation, delegation, and license optimization.

## Workflow

The script performs the following steps in order:

1.  **Block Sign-in:** Ensures the user account is disabled in Entra ID (Azure AD).
2.  **Convert to Shared Mailbox:** Converts the user's Exchange Online mailbox to a "Shared Mailbox". This preserves mailbox data indefinitely for free (under 50GB) and frees up the Office 365 license.
3.  **Hide from GAL:** Hides the user from the Global Address List so they no longer appear in Outlook address books.
4.  **Grant Manager Access:** Assigns "Full Access" and "Send As" permissions (AutoMapped) to the specified manager, allowing them to monitor the leaver's email.
5.  **Reclaim Licenses:** Removes all assigned Office 365 licenses from the user account to stop billing.

## Prerequisites

*   **PowerShell 7+ (Core):** Recommended.
*   **Modules:** Requires **both** of the following modules:
    ```powershell
    Install-Module Microsoft.Graph -Scope CurrentUser
    Install-Module ExchangeOnlineManagement -Scope CurrentUser
    ```
*   **Permissions:** The running account needs:
    *   **Entra ID:** `User Administrator` or `Global Administrator` (to manage users and licenses).
    *   **Exchange Online:** `Exchange Administrator` or `Global Administrator` (to manage mailboxes).

## Usage

Run the script from a PowerShell console. You will likely need to authenticate interactively for Exchange Online.

```powershell
.\GracefulOffboarding_Script\Invoke-GracefulOffboarding_Action.ps1 -UserPrincipalName "leaver@domain.com" -ManagerEmail "manager@domain.com"
```

### Parameters

*   `-UserPrincipalName` (string, Mandatory): The UPN of the employee leaving the company.
*   `-ManagerEmail` (string, Mandatory): The UPN/Email of the manager receiving access to the data.
*   `-ExecuteLive` (switch):
    *   If **Omitted** (Default): Runs in **SIMULATION MODE**. Reports what would happen without making changes.
    *   If **Included** (`-ExecuteLive`): **EXECUTES** the offboarding actions immediately.

### Examples

**1. Simulation (Default)**
Preview the offboarding steps for "john.doe".
```powershell
.\GracefulOffboarding_Script\Invoke-GracefulOffboarding_Action.ps1 -UserPrincipalName "john.doe@contoso.com" -ManagerEmail "jane.boss@contoso.com"
```

**2. Live Offboarding**
Perform the actual offboarding.
```powershell
.\GracefulOffboarding_Script\Invoke-GracefulOffboarding_Action.ps1 -UserPrincipalName "john.doe@contoso.com" -ManagerEmail "jane.boss@contoso.com" -ExecuteLive
```

## Notes

*   **Exchange Connection:** The script attempts to connect to Exchange Online. If you are not already connected, it may prompt for authentication.
*   **Shared Mailbox Conversion:** This step usually requires the user to still have a license attached *at the moment of conversion*. The script handles this by converting *before* removing the license.
