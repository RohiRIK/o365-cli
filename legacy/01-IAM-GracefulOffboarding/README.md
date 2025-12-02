# Graceful Offboarding Engine (IAM-01)

## 🚀 Vision & Purpose
The **Graceful Offboarding Engine** is designed to be the industry-standard automation for employee departures. Unlike crude "delete" scripts, this module orchestrates a **humane, compliant, and data-preserving exit** for staff. It ensures business continuity by transferring knowledge (email/files) to managers while immediately securing the perimeter and stopping financial waste.

It effectively bridges the gap between **HR's Termination Date** and **IT's Security Requirements**.

## 💎 Key Features & Capabilities

### 🛡️ Security & Identity
*   **Immediate Access Revocation:** Instantaneously disables Entra ID sign-in and forces a session token revocation (Revoke-MgUserSignInSession) to boot users from active apps (Teams, Outlook, Sharepoint) within minutes.
*   **MFA Device Scrubbing:** Removes registered MFA methods and Authenticator devices to prevent "zombie" re-entry.
*   **GAL Hiding:** Automatically hides the user from the Global Address List (GAL) to prevent new internal emails from being routed to a dead inbox.

### 📦 Data Preservation & Handover
*   **Smart Mailbox Conversion:** Converts User Mailboxes to **Shared Mailboxes**.
    *   *Benefit:* Preserves data indefinitely without consuming a paid license (up to 50GB).
    *   *Benefit:* Allows concurrent access by multiple delegates.
*   **Manager Delegation:**
    *   Automatically detects the user's `Manager` attribute in AD/Entra ID.
    *   Grants `FullAccess` and `SendAs` permissions to the manager for business continuity.
*   **OneDrive Archival:**
    *   Initiates a "Retention Lock" on the user's OneDrive.
    *   Generates a secure access link for the manager to retrieve personal files before final deletion.
*   **Auto-Reply Configuration:** Sets a standardized "I have left the organization" Out-of-Office message directing senders to the manager or a support alias.

### 💰 License Optimization
*   **Instant Reclamation:** Scans for all assigned licenses (E3, E5, Visio, Project) and removes them *immediately* after mailbox conversion.
*   **Cost Reporting:** Logs the exact dollar amount saved per offboarding event based on current SKU pricing.

## 🛠️ Technical Architecture

### Prerequisites
*   **PowerShell 7+ (Core)**
*   **Microsoft Graph API:** `User.ReadWrite.All`, `Directory.ReadWrite.All`, `MailboxSettings.ReadWrite`
*   **Exchange Online Management:** V3 Module for mailbox conversion.

### Execution Flow
1.  **Trigger:** Script receives `UserPrincipalName` and optional `TerminationDate`.
2.  **Validation:** Verifies user existence and manager status.
3.  **Lockdown:** Disables account, revokes tokens.
4.  **Exchange Operations:** Converts mailbox, hides from GAL, sets Auto-Reply.
5.  **Delegation:** Grants permissions to Manager.
6.  **Cleanup:** Removes licenses, clears group memberships.
7.  **Reporting:** Outputs a JSON/CSV summary of actions taken.

## 🔮 Future Roadmap (The "Massive" Vision)
*   **HRIS Integration:** Webhook listener to trigger offboarding automatically from Workday/BambooHR events.
*   **Archive-to-Blob:** Option to export Mailbox (PST) and OneDrive files directly to Azure Blob Storage (Cold Tier) for long-term, ultra-low-cost compliance archiving.
*   **SaaS App Deprovisioning:** Extension hooks to call APIs of 3rd party apps (Salesforce, Slack, Zoom) to deactivate accounts outside of Microsoft 365.
*   **Device Retrieval Logistics:** Integration with shipping APIs (FedEx/UPS) to generate return shipping labels for corporate laptops.