# Shadow IT Governance Engine (SEC-02-S)

## 🚀 Vision & Purpose
The **Shadow IT Governance Engine** is the "Immune System" for your tenant's application layer. Users constantly grant 3rd-party apps (OAuth) access to corporate data ("Read my Calendar", "Access my Files"). While convenient, this bypasses traditional firewalls and creates permanent backdoors.

This module monitors, assesses, and **ruthlessly eliminates** unauthorized applications, turning Entra ID into a pristine, sanctioned-only environment.

## 💎 Key Features & Capabilities

### 🧠 Intelligent Risk Scoring
*   **Scope Analysis:** Rates every app based on the OAuth scopes it holds.
    *   *Critical Risk:* `Mail.Read`, `Files.Read.All`, `Directory.ReadWrite.All`.
    *   *High Risk:* `Contacts.Read`, `User.ReadWrite`.
    *   *Low Risk:* `User.Read` (Sign-in only).
*   **Publisher Verification:** Flags apps from "Unverified Publishers" as higher risk.
*   **Credential Hygiene:** Checks if the Service Principal has expired secrets or certificates.

### 🛡️ Automated Remediation
*   **The "Kill Switch":** Can run in `RemediationMode` to automatically revoke (delete) permission grants for any app exceeding a risk threshold.
*   **Whitelist/Allowlist:** Robust support for "Sanctioned Apps" (Zoom, Slack, Adobe) ensuring business-critical tools are never touched.
*   **User Notification:** When an app is revoked, the engine sends a friendly educational email to the user explaining *why* it was removed and linking to the Approved App Catalog.

### 🔍 Contextual Awareness
*   **User Correlation:** Enriches the report with user details (Department, Manager). *Example: "Why is a Warehouse user granting 'Salesforce' access to their email?"*
*   **Dormancy Check:** Identifies "Zombie Grants"—risky apps connected to users who haven't signed in for 6 months.

## 🛠️ Technical Architecture

### Prerequisites
*   **PowerShell 7+**
*   **Microsoft Graph API:** `DelegatedPermissionGrant.ReadWrite.All`, `Application.Read.All`, `User.Read.All`.

### Configuration
*   `HighRiskScopes`: Customizable list of forbidden permissions.
*   `AllowedAppIds`: GUIDs of sanctioned apps.
*   `DryRun`: Safety toggle (Audit vs. Enforce).

## 🔮 Future Roadmap (The "Massive" Vision)
*   **Community Reputation:** Integration with external threat intel feeds to check App IDs against known malicious app databases.
*   **Policy Engine:** Define granular policies like "Marketing users can grant Social Media apps, but Finance users cannot."
*   **Just-In-Time (JIT) Consent:** A workflow where users request app access via Teams, and IT approves it for a limited duration (e.g., 30 days).