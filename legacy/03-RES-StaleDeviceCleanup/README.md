# Smart Stale Device Cleanup Tool

This PowerShell script, `Invoke-StaleDevice_Cleanup.ps1`, is an intelligent maintenance tool designed to keep your Microsoft Entra ID (Azure AD) device inventory clean and secure. It identifies and removes stale devices based on inactivity while employing advanced safeguards to prevent accidental deletion of critical assets.

## Key Features

*   **Registration Type Awareness (TrustType):** The script distinguishes between different device types:
    *   `AzureAd`: Cloud-only joined devices.
    *   `Workplace`: Registered personal devices (BYOD).
    *   `ServerAd`: Hybrid AD joined devices (on-premises sync).
*   **Hybrid Protection:** By default, the script **excludes** Hybrid Joined devices (`ServerAd`) from cleanup. Deleting these in the cloud without removing them from on-premises AD can cause sync errors ("zombie devices").
*   **Autopilot Safety:** It automatically detects and skips devices with a specialized `ProfileType` (often indicating Windows Autopilot or Kiosk mode), preventing the accidental deletion of zero-touch deployment records.
*   **Configurable Staleness:** You can define the exact number of days (`-DaysInactive`) before a device is considered stale.

## Prerequisites

*   **PowerShell 7+ (Core):** Recommended.
*   **Microsoft Graph PowerShell Module:**
    ```powershell
    Install-Module Microsoft.Graph -Scope CurrentUser
    ```
*   **Permissions:** The account running the script needs:
    *   `Device.ReadWrite.All` (to delete devices)
    *   `Device.Read.All` (to scan)

## Usage

Run the script from a PowerShell console.

```powershell
.\StaleDevice_Script\Invoke-StaleDevice_Cleanup.ps1
```

### Parameters

*   `-ExecuteLive` (switch): If present, the script **PERMANENTLY DELETES** identified stale devices. If omitted (default), it runs in "Audit Mode" and only reports what would be deleted.
*   `-DaysInactive` (int): The number of days a device must be inactive to be considered stale. Default: `90`.
*   `-TargetTrustType` (string[]): The types of devices to clean. Default: `@("AzureAd", "Workplace")`.
    *   To clean everything including Hybrid (Use Caution!): `-TargetTrustType "AzureAd", "Workplace", "ServerAd"`
*   `-ReportPath` (string): Path to the CSV report. Default: `.\StaleDevices_Report.csv`.

### Examples

**1. Audit (Dry Run) - Default**
Scan for stale cloud and BYOD devices inactive for 90 days. No changes made.
```powershell
.\StaleDevice_Script\Invoke-StaleDevice_Cleanup.ps1
```

**2. Live Cleanup**
Delete stale devices that haven't checked in for 120 days.
```powershell
.\StaleDevice_Script\Invoke-StaleDevice_Cleanup.ps1 -DaysInactive 120 -ExecuteLive
```

**3. Clean Only BYOD Devices**
Target only personal devices (`Workplace`) that are stale.
```powershell
.\StaleDevice_Script\Invoke-StaleDevice_Cleanup.ps1 -TargetTrustType "Workplace" -ExecuteLive
```

## Report Output (`StaleDevices_Report.csv`)

The CSV report contains:
*   **DeviceName:** Display name of the device.
*   **DeviceId:** The unique Entra ID object ID.
*   **TrustType:** The registration type (AzureAd, Workplace, etc.).
*   **OS:** The operating system.
*   **LastSeen:** Approximate last sign-in timestamp.
*   **CreatedDate:** When the device was registered.
*   **Status:** `Pending` (Audit) or `Deleted` (Live).
*   **Reason:** Why the device was flagged (e.g., "Inactive (AzureAd) since 2023-01-01").
