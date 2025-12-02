# External Sharing & Perimeter Audit System (SEC-02)

## 🚀 Vision & Purpose
The **External Sharing & Perimeter Audit System** is the "X-Ray Machine" for your Microsoft 365 file security. SharePoint and OneDrive make sharing easy—too easy. Over time, tenants accumulate thousands of "Anyone with the link" (Anonymous) URLs and "Specific People" shares that expose sensitive corporate IP to the public internet.

This module provides **Deep Visibility** into exactly *what* is leaving your perimeter, *who* shared it, and *who* can access it. It acts as the first line of defense against Data Exfiltration.

## 💎 Key Features & Capabilities

### 🔍 Deep Scanning Engine
*   **Tenant-Wide Crawl:** Iterates through **Every** SharePoint Site and **Every** User's OneDrive.
*   **Permission Analysis:**
    *   Detects **Anonymous Links** (Publicly accessible, no auth required).
    *   Detects **External Guest Links** (Authenticated external users).
    *   Detects **Company Wide Links** (Internal, but potentially over-shared).
*   **Recursion:** Capable of scanning root drives or diving deep into sub-folder permission inheritance (configurable depth).

### 🚨 Risk Intelligence
*   **Sensitivity Label Awareness:** (Future) Correlates sharing links with MIP (Microsoft Information Protection) labels. *Flags "Highly Confidential" files shared externally as Critical Incidents.*
*   **Owner Identification:** Pinpoints the exact internal user who created the share, enabling targeted coaching or remediation.
*   **Stale Link Detection:** Identifies sharing links created >90 days ago that are likely no longer needed.

### 📊 Forensic Reporting
*   **Incident CSV:** Generates a granular row-by-row report of every risky file.
    *   Columns: `Site`, `File`, `SharedBy`, `SharedWith`, `LinkType`, `DateCreated`, `AccessCount`.
*   **Executive Summary:** Aggregates data to show "Top 10 Risky Sites" and "Top 10 External Sharers".

## 🛠️ Technical Architecture

### Prerequisites
*   **PowerShell 7+**
*   **Microsoft Graph API:** `Sites.Read.All`, `Files.Read.All`, `Reports.Read.All`

### Logic Flow
1.  **Discovery:** `Get-MgSite` & `Get-MgUser` to build the scan scope.
2.  **Enumeration:** `Get-MgDrive` -> `Get-MgDriveItem` -> `Get-MgDriveItemPermission`.
3.  **Filtering:** Discard "internal" permissions; keep "sp.someone", "anonymous".
4.  **Output:** Stream objects to CSV report.

## 🔮 Future Roadmap (The "Massive" Vision)
*   **Auto-Expiration Enforcement:** A remediation mode that automatically sets an expiration date (e.g., 7 days) on any newly discovered Anonymous link.
*   **Content Inspection (DLP):** Integration with Microsoft Purview to sample the *content* of shared files for PII/Credit Cards and prioritize the audit report accordingly.
*   **"Nudge" Bot:** An automated Teams bot that chats users: *"Hey, you shared 'Budget.xlsx' with a Gmail account 6 months ago. Do you still need this active?"*
*   **Visual Relationship Map:** Generate a Graphviz/Mermaid diagram showing the web of connections between internal users and external domains.