# Guest User Lifecycle Manager (IAM-01-G)

## 🚀 Vision & Purpose
The **Guest User Lifecycle Manager** is the ultimate governance tool for the "External Collaboration" wild west. In modern tenants, Guest accounts (vendors, partners, contractors) accumulate rapidly and are rarely cleaned up, leading to **security holes** and **compliance failures**.

This module treats Guest Users as temporary assets with a definite lifecycle: **Provision -> Monitor -> Review -> Expire -> Delete**. It enforces a "Zero Trust" approach to external access.

## 💎 Key Features & Capabilities

### 🕵️‍♂️ Deep Discovery & Audit
*   **Staleness Detection:** Uses advanced heuristic analysis of `SignInActivity`, `LastPasswordChange`, and `CreatedDateTime` to identify guests who have ghosted the tenant.
*   **Sponsor Attribution:**
    *   Attempts to link every Guest user to an internal **Sponsor** (Manager).
    *   If `Manager` attribute is null, it scans `AuditLogs` to find *who invited* the guest originally.
*   **Ghost Identification:** Flags "Accepted" guests who have *never* actually signed in (phantoms).

### ♻️ Automated Lifecycle Workflow
*   **Stage 1: Warning (T-30 Days):** Sends a branded email to the Guest (and their Sponsor) warning of upcoming account expiration.
*   **Stage 2: Soft Disable (T-0 Days):** Sets `AccountEnabled = $false`. The user is blocked but data is intact.
*   **Stage 3: Asset Handover:**
    *   Before deletion, checks if the Guest owns any SharePoint sites, Teams, or has a mailbox.
    *   Transfers ownership to the Sponsor to prevent orphaned resources.
*   **Stage 4: Hard Delete (T+30 Days):** Permanently removes the guest user object from Entra ID.

### 🔗 Integration & Webhooks
*   **Orphan Handler:** If a stale guest has NO sponsor, the script triggers a webhook (e.g., ServiceNow, Jira, Teams Channel) to create a "Cleanup Ticket" for IT Service Desk.
*   **Whitelist/Allowlist:** Robust exclusion logic supporting "Partner Domains" (e.g., `*@partner.com`) or specific VIP User IDs to prevent accidental deletion of strategic partners.

## 🛠️ Technical Architecture

### Prerequisites
*   **PowerShell 7+**
*   **Microsoft Graph API:** `User.ReadWrite.All`, `AuditLog.Read.All`, `Directory.Read.All`

### Configuration Parameters
*   `DaysToDisable` (Default: 90): Inactivity threshold for blocking.
*   `DaysToDelete` (Default: 180): Threshold for permanent removal.
*   `ExcludedDomains`: Array of domains to never touch.
*   `WebhookUrl`: Endpoint for orphaned user alerts.

## 🔮 Future Roadmap (The "Massive" Vision)
*   **Self-Service Extension Portal:** A lightweight web app where Sponsors can click "Renew Access" to extend a Guest's lifecycle by 90 days, resetting the timer.
*   **Access Certification Campaigns:** Automated generation of "Access Reviews" (Identity Governance) based on custom triggers logic not available in native Entra ID P2.
*   **Teams Inactivity Correlation:** Cross-reference Guest inactivity with their specific activity inside specific Teams channels (e.g., "Guest active in tenant, but hasn't visited Project X Team in 6 months -> Remove from Team only").