# License Optimization & ROI Analyzer Suite v2.0

This PowerShell tool is a comprehensive solution for Microsoft 365 license management. It goes beyond simple inventory to detecting financial waste, redundant subscriptions, and "Zombie" accounts.

## Key Features

### 1. Financial ROI Analysis
*   Calculates **Monthly Waste** based on a customizable SKU Cost Map.
*   Identifies potential savings from reclaiming licenses from disabled or inactive users.

### 2. Redundancy Detection
*   Automatically flags users who hold overlapping licenses.
*   **Example:** A user assigned `Office 365 E3` (which includes Exchange) AND a standalone `Exchange Online (Plan 2)`. The script recommends removing the standalone SKU.

### 3. "Zombie" & Inactivity Detection
*   **Zombie Users:** Accounts that are disabled (`AccountEnabled = $false`) but still consume a paid license.
*   **Ghost Users:** Accounts created >30 days ago that have *never* signed in.
*   **Stale Users:** Active accounts with no sign-in activity for >60 days.

### 4. Remediation Ready
*   Generates a secondary CSV (`_RemediationInput.csv`) specifically formatted for automation tools to perform bulk license removal.

### 5. Executive HTML Dashboard
*   Produces a visual `_Dashboard.html` file with key metrics (Total Waste, Zombie Count) and a "Top 10 Waste" table for quick executive reporting.

## Prerequisites

*   **PowerShell 7+ (Core)**
*   **Microsoft Graph PowerShell Module:**
    ```powershell
    Install-Module Microsoft.Graph -Scope CurrentUser
    ```
*   **Permissions:**
    *   `User.Read.All`
    *   `Directory.Read.All`
    *   `Reports.Read.All`

## Usage

```powershell
.\03-RES-LicenseOptimization\Invoke-LicenseOptimization_Report.ps1
```

### Parameters

*   `-ReportPath`: Base path for reports. (Default: `.\LicenseOptimization_Report.csv`).
*   `-CostMap`: A hashtable defining your specific license costs.
    *   **Defaults:** E5 ($57), E3 ($32), Business Std ($12.50), PowerBI Pro ($10), Visio Plan 2 ($15).

### Outputs

The script generates three files:

1.  **`LicenseOptimization_Report.csv`**: The detailed audit log of every user and their status.
2.  **`LicenseOptimization_RemediationInput.csv`**: A filtered list of actions to take (e.g., "Remove-License").
3.  **`LicenseOptimization_Dashboard.html`**: A visual summary for management.
