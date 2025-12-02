# 360° Offboarding Intelligence & Forensic Report (REP-04)

## 🚀 Vision & Purpose
The **360° Offboarding Intelligence** module is the "Sherlock Holmes" of identity management. Before you offboard a user, you need to know *exactly* what they have access to. A simple "Disable" is insufficient if the user owns critical SharePoint sites, manages key distribution lists, or has 50 active guest invites associated with them.

This tool generates a **holistic, deep-dive dossier** on a user's digital footprint, enabling IT to make informed decisions about delegation, asset transfer, and risk mitigation.

## 💎 Key Features & Capabilities

### 🔍 The "360 View" (Data Gathering)
*   **Identity Risk:** Detects if the user is a Global Admin, has stale passwords, or is an orphan (no manager).
*   **Asset Inventory:**
    *   **Licenses:** What are we paying for? (E5, Visio, Project).
    *   **Devices:** What corporate laptops/mobiles are in their possession?
    *   **Cloud Resources:** What SharePoint Sites or Teams do they *Own*? (Crucial for preventing ownerless teams).
*   **Activity Forensics:**
    *   Last Sign-in Date (Exchange, SharePoint, Entra ID).
    *   Geolocation of last login (Risk indicator).

### 🧠 Recommendation Engine
The script doesn't just list data; it provides **Advice**:
*   *IF* User is Admin -> **Recommendation:** "Revoke Admin Roles Immediately".
*   *IF* User owns 10 Teams -> **Recommendation:** "Delegate ownership to Manager".
*   *IF* User has high file activity -> **Recommendation:** "Legal Hold Advisory".

### 🚦 Lifecycle Phase Detection
Automatically categorizes the user into a lifecycle stage:
*   **ACTIVE:** Healthy.
*   **AT RISK:** Active but has red flags (e.g., Admin with no MFA).
*   **DISABLE CANDIDATE:** Inactive > 60 days.
*   **DECOMMISSION CANDIDATE:** Disabled > 90 days (Ready for license removal).
*   **DELETE CANDIDATE:** Disabled > 365 days.

## 🛠️ Technical Architecture

### Prerequisites
*   **PowerShell 7+**
*   **Microsoft Graph API:** `User.Read.All`, `AuditLog.Read.All`, `Device.Read.All`, `Group.Read.All`, `Directory.Read.All`.

### Performance
*   **Parallel Processing:** Uses multi-threading (Runspaces/Jobs) to scan thousands of users in minutes, not hours.

## 🔮 Future Roadmap (The "Massive" Vision)
*   **Flight Risk Prediction:** Use AI/ML to analyze behavior patterns (e.g., mass file downloads + late night logins) to predict employees likely to leave/steal data *before* they resign.
*   **Visual Graph:** Generate a visual node map showing the user's connection to other users, groups, and applications.
*   **SaaS App Discovery:** Query non-Microsoft logs (Okta/Zscaler) to append "Shadow IT" usage to the user's dossier.