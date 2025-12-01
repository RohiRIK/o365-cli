# Surgical Lockdown Tool

This PowerShell script, `Invoke-SurgicalLockdown.ps1`, is an emergency response tool designed to immediately neutralize a compromised or hostile user account within your Microsoft 365 and Entra ID (Azure AD) environment. It performs a multi-layered lockdown across Identity, Mobile Devices, and Endpoints to contain a security incident.

## **CRITICAL WARNING:**

**This script performs destructive actions when not in simulation mode. Always use the `-Simulate` parameter first to review proposed changes.**

## Key Features

The tool orchestrates a rapid response by performing the following actions:

### **Phase 1: Identity Lockdown**

*   **Block Sign-in:** Immediately sets the user's account to `AccountEnabled = $false`, preventing any further logins.
*   **Revoke Refresh Tokens:** Forces all active sessions to terminate, logging the user out of all applications (e.g., Teams, Outlook, SharePoint).
*   **Scramble Password:** Resets the user's password to a random, complex string, rendering any known credentials unusable. The user will be forced to change their password on next sign-in (if account is re-enabled).

### **Phase 2: Mobile Devices (Selective Wipe)**

*   **Retire Device:** For mobile devices (iOS/Android) enrolled in Intune, it issues a "Retire" command. This removes all corporate data (apps, emails, documents) while leaving the user's personal data intact, minimizing impact on BYOD devices.

### **Phase 3: Windows Endpoints (Isolation)**

*   **Isolate Machine:** For Windows devices managed by Intune and integrated with Microsoft Defender for Endpoint (MDE), it triggers an "Isolate" command. This action isolates the endpoint from the network, preventing further lateral movement or data exfiltration.

## Prerequisites

*   **PowerShell 7+ (Core):** Recommended.
*   **Microsoft Graph PowerShell Module:**
    ```powershell
    Install-Module Microsoft.Graph -Scope CurrentUser
    ```
*   **Permissions:** The running account requires extensive permissions to execute these actions:
    *   `User.ReadWrite.All` (for block/reset/scramble)
    *   `DeviceManagementManagedDevices.ReadWrite.All` (for Retire command)
    *   `DeviceManagementManagedDevices.PrivilegedOperations.All` (for Isolate command)

## Usage

Run the script from a PowerShell console. A `UserPrincipalName` is mandatory.

```powershell
.\SurgicalLockdown_Script\Invoke-SurgicalLockdown.ps1 -UserPrincipalName "target.user@yourdomain.com"
```

### Parameters

*   `-UserPrincipalName` (string, Mandatory): The UPN of the user to target for lockdown.
*   `-Simulate` (boolean, default: `$true`):
    *   If `$true`, the script performs a dry run, reporting all planned actions without making any actual changes.
    *   If `$false`, the script **EXECUTES** the lockdown actions immediately. **USE WITH EXTREME CAUTION.**
*   `-IsolationComment` (string, default: `"Security Incident: Immediate Lockdown Protocol Initiated"`): A comment logged in Defender for Endpoint logs when a device is isolated.

### Examples

**1. Simulation Mode (Default)**
Review all planned actions for "bad.actor@company.com" before execution.
```powershell
.\SurgicalLockdown_Script\Invoke-SurgicalLockdown.ps1 -UserPrincipalName "bad.actor@company.com"
```

**2. Execute Live Lockdown (HIGHLY DESTRUCTIVE - USE WITH CAUTION)**
Execute the full lockdown protocol for "compromised.user@company.com".
```powershell
.\SurgicalLockdown_Script\Invoke-SurgicalLockdown.ps1 -UserPrincipalName "compromised.user@company.com" -Simulate:$false
```

## Report Output (`SurgicalLockdown_Report.csv`)

The script generates a CSV report logging all actions that were simulated or executed.

*   **Phase:** The phase of the lockdown (e.g., `Identity`, `Mobile`, `Endpoint`).
*   **Action:** The specific action performed or simulated (e.g., `Block Account`, `Retire Device`).
*   **Target:** The user UPN or device ID affected.
*   **Status:** `Pending (Simulation)` (dry run) or `Executed`/`Command Sent`/`Isolation Triggered`/`Failed` (live run).
