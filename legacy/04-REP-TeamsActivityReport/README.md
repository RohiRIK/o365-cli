# Teams Sprawl & Activity Auditor (REP-04-T)

## 🚀 Vision & Purpose
The **Teams Sprawl & Activity Auditor** is the city planner for your Microsoft Teams environment. Teams is great for collaboration but prone to **"Sprawl"**—thousands of abandoned teams, empty channels, and ownerless groups that consume storage and confuse users.

This module provides the **Visibility** needed to govern Teams effectively, ensuring every Team has a purpose, an owner, and active engagement.

## 💎 Key Features & Capabilities

### 🕵️‍♂️ Sprawl Detection
*   **Zombie Teams:** Identifies Teams with no chat/file activity in >90 days.
*   **Empty Shells:** Identifies Teams created >30 days ago with 0 members or 0 content.
*   **Ownerless Teams:** Flags groups where the owners have been deleted or disabled (Orphaned).

### 🛡️ Security & External Access
*   **Guest Density:** Calculates the ratio of Guest vs. Member users per Team. Flags "High Risk" teams (e.g., >50% external).
*   **Public Team Exposure:** Audits "Public" teams that contain sensitive keywords (e.g., "HR", "Finance", "Strategy") in their name.

### 📊 Storage Analytics
*   **Quota Forecasting:** Tracks SharePoint storage consumption per Team. Identifies top consumers.
*   **File Aging:** (Future) Reports on the percentage of files in the Team that haven't been touched in 1 year.

## 🛠️ Technical Architecture

### Prerequisites
*   **PowerShell 7+**
*   **Microsoft Graph API:** `Team.ReadBasic.All`, `Group.Read.All`, `Reports.Read.All`.

### Outputs
*   **Sprawl Report (CSV):** `TeamName`, `Owner`, `MemberCount`, `GuestCount`, `LastActivityDate`, `StorageUsedGB`, `Status`.

## 🔮 Future Roadmap (The "Massive" Vision)
*   **Auto-Archive Workflow:** A policy engine that automatically moves "Zombie Teams" to a "Read-Only" state after 180 days of silence.
*   **Attestation Bot:** An Adaptive Card sent to Team Owners every 6 months asking: *"Is this Team still needed? [Keep] [Archive] [Delete]"*.
*   **Sensitivity Label Enforcement:** Automatically apply "Confidential" labels to Teams detected discussing PII or financial data.