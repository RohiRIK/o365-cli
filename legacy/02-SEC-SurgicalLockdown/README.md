# Surgical Lockdown / Emergency Kill Switch (SEC-02-K)

## 🚀 Vision & Purpose
The **Surgical Lockdown Tool** is the **"Break Glass"** protocol for high-severity security incidents (e.g., Ransomware active on a device, Insider Threat, Hostile Termination).

Unlike standard offboarding, this module prioritizes **Speed** and **Containment** over user experience. It creates an immediate "air gap" around the compromised user identity and their devices, effectively neutralizing the threat in seconds.

## 💎 Key Features & Capabilities

### 🔥 Multi-Layered Containment (The Kill Chain)
*   **Layer 1: Identity (Entra ID):**
    *   **Block Sign-in:** `AccountEnabled = $false`.
    *   **Token Nuke:** Revokes all Refresh Tokens (`Revoke-MgUserSignInSession`), forcing immediate logout from Web Apps, Outlook, and Teams.
    *   **Credential Scramble:** Resets password to a cryptographically random 64-character string.
*   **Layer 2: Mobile (Intune):**
    *   **Selective Wipe:** Issues a `Retire` command to BYOD devices to strip corporate data/apps while leaving personal photos intact.
    *   **Full Wipe:** (Optional) Issues `Wipe` command for corporate-owned devices.
*   **Layer 3: Endpoint (Defender):**
    *   **Network Isolation:** Triggers the "Isolate Device" API in Defender for Endpoint (MDE). The laptop remains on, but its network adapter cuts all traffic except to the Defender management server.

### 📝 Forensic Audit Trail
*   **Incident Logging:** Records every action taken, the timestamp (UTC), and the admin responsible into a tamper-evident log.
*   **Defender Tagging:** Adds a "Compromised" or "Investigation" tag to the device in MDE to alert SOC analysts.

## 🛠️ Technical Architecture

### Prerequisites
*   **PowerShell 7+**
*   **Microsoft Graph API:** `User.ReadWrite.All`, `Directory.AccessAsUser.All`
*   **Intune Permissions:** `DeviceManagementManagedDevices.ReadWrite.All`
*   **Defender Permissions:** `Machine.Isolate` (via Graph or MDE API).

### Input
*   `UserPrincipalName`: The target.
*   `IsolationComment`: Required field for audit logs (e.g., "Ticket #1234 - Ransomware Detected").

## 🔮 Future Roadmap (The "Massive" Vision)
*   **SOC Integration:** Automatically trigger a "High Severity" incident in Microsoft Sentinel or Splunk upon execution.
*   **Legal Hold Activation:** Automatically place the user's Exchange Mailbox and OneDrive into Litigation Hold to preserve evidence for prosecution.
*   **Cross-Platform Lock:** Extend API hooks to revoke sessions in Okta, Salesforce, and AWS via their respective APIs during the lockdown event.
*   **Kill Switch GUI:** A simplified "Panic Button" web interface for Helpdesk staff (with heavy approval gates) to trigger this without touching PowerShell.