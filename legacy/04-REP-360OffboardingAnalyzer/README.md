# 360° Employee Offboarding Analyzer Script

This PowerShell script, `Invoke-Employee360_Report.ps1`, is designed to generate a comprehensive report on user accounts within your Microsoft 365 and Entra ID (Azure AD) environment. It goes beyond basic offboarding status to provide deep insights and recommendations for security, cost optimization, and operational efficiency.

## Key Features & Insights (The "Killer Features")

The script analyzes various aspects of user accounts to provide actionable recommendations, categorized for easy review:

*   **[CRITICAL] Dormant Admin:** Identifies users with administrative roles who have not signed in for more than 30 days. This is a significant security risk.
*   **[SECURITY] Stale Guest Account:** Flags external guest users who have been inactive for over 90 days, indicating potential unmonitored access.
*   **[SECURITY] Stale Password:** Highlights users whose passwords have not been changed in over a year, increasing vulnerability to credential stuffing attacks.
*   **[RISK] Orphaned Account:** Detects active internal users who do not have a manager assigned, which can lead to governance and operational issues.
*   **[GOVERNANCE] Excessive Group Membership:** Points out users who are members of more than 50 security or distribution groups, potentially indicating "permission creep" or over-privileging.
*   **[COST] License Waste:** Identifies licensed users who have been inactive for more than 60 days, suggesting opportunities for license reclamation and cost savings.
*   **[CLEANUP] Revoke Access:** General recommendation for users inactive for more than 180 days, indicating they are candidates for access revocation.

## Prerequisites

*   **PowerShell 7+ (Core):** The script utilizes modern PowerShell features.
*   **Microsoft Graph PowerShell Module:** Ensure you have the `Microsoft.Graph` module installed.
    ```powershell
    Install-Module Microsoft.Graph -Scope CurrentUser
    ```
*   **Permissions:** The user account running the script needs appropriate administrative roles in Entra ID, including at least:
    *   `User.Read.All`
    *   `AuditLog.Read.All`
    *   `Directory.Read.All`
    *   `Device.Read.All`
    *   `GroupMember.Read.All`
    *   `User.ReadBasic.All` (for manager details)

## Usage

Run the script from a PowerShell 7+ console.

```powershell
.\360_Offboarding_Script\Invoke-Employee360_Report.ps1
```

### Parameters

*   `-DryRun` (default: `$true`): When `$true`, the script simulates actions and reports what *would* happen without making any changes. When `$false`, it executes the proposed offboarding actions.
*   `-DaysToDisable` (default: `60`): Number of days inactive after which an enabled account is flagged for `DISABLE`.
*   `-DaysToDecommission` (default: `90`): Number of days inactive after which a disabled account is flagged for `DECOMMISSION`.
*   `-DaysToDelete` (default: `365`): Number of days inactive after which a disabled account is flagged for `DELETE`.
*   `-ExcludedUPNs` (default: `("ceo@yourdomain.com")`): An array of User Principal Names (UPNs) to explicitly exclude from processing.

### Example

```powershell
# Generate a report without making any changes (Dry Run - default behavior)
.\360_Offboarding_Script\Invoke-Employee360_Report.ps1

# Run the script and execute offboarding actions (e.g., disable users)
.\360_Offboarding_Script\Invoke-Employee360_Report.ps1 -DryRun $false -DaysToDisable 30 -DaysToDecommission 60
```

## Report Output (`360_Offboarding_Report.csv`)

The script generates a single CSV file containing a comprehensive user inventory along with offboarding phases and actionable recommendations.

| Column                | Description                                                                                                                                              |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                | The display name of the user.                                                                                                                            |
| `UPN`                 | The User Principal Name of the account.                                                                                                                  |
| `JobTitle`            | The user's job title (defaults to "N/A" if not found in Entra ID).                                                                                       |
| `Department`          | The user's department (defaults to "N/A" if not found in Entra ID).                                                                                      |
| `Manager`             | The UPN or email of the user's manager (defaults to "N/A" if no manager is assigned).                                                                    |
| `DaysInactive`        | The number of days since the user's last sign-in or account creation date (if never signed in).                                                          |
| `Phase`               | The recommended offboarding phase: `Active`, `DISABLE`, `DECOMMISSION`, or `DELETE`.                                                                     |
| `Licenses`            | A semicolon-separated list of assigned license SKU part numbers.                                                                                         |
| `Devices`             | A semicolon-separated list of devices owned by the user.                                                                                                 |
| `Groups`              | A semicolon-separated list of display names for groups the user is a member of.                                                                          |
| `ActionStatus`        | Indicates if the action for the `Phase` is `Pending` (dry run) or `Executed` (live run).                                                                 |
| `Recommendations`     | A semicolon-separated list of actionable insights and recommendations based on the "Killer Features" analysis (e.g., `[RISK] Orphaned Account`).           |
