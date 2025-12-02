# Mailbox Permissions Sentinel (SEC-02-M)

## 🚀 Vision & Purpose
The **Mailbox Permissions Sentinel** is an automated auditor for Exchange Online delegation. In many organizations, "Full Access" and "Send As" permissions are granted ad-hoc and never revoked. This leads to **Privilege Creep** and potential lateral movement paths for attackers (e.g., if a user is compromised, the attacker gains access to every mailbox that user has rights to).

This module provides **Continuous Assurance** that only authorized delegates have access to sensitive mailboxes.

## 💎 Key Features & Capabilities

### 👁️ Permission Discovery
*   **Full Scope Scan:** Iterates through User Mailboxes, Shared Mailboxes, and Resource Mailboxes (Room/Equipment).
*   **Granular Rights Analysis:**
    *   Detects `FullAccess` (Read/Delete everything).
    *   Detects `SendAs` (Impersonation).
    *   Detects `SendOnBehalf` (Delegation).
*   **Owner Exclusion:** Automatically filters out the mailbox owner's own permissions to reduce noise.

### 🚨 Anomaly Detection
*   **Cross-Departmental Access:** Flags instances where a user in "Sales" has access to a mailbox in "HR".
*   **Service Account Watch:** Monitors non-interactive service accounts that have accumulated excessive mailbox rights.
*   **Dormant Delegate Check:** Identifies delegates who are themselves disabled/inactive but still hold rights to active mailboxes.

### 📊 Reporting
*   **Access Matrix:** Generates a CSV mapping `Mailbox` -> `User` -> `AccessLevel`.
*   **Risk Score:** Assigns a risk level to each permission based on the sensitivity of the target mailbox (e.g., CEO's mailbox = High Risk).

## 🛠️ Technical Architecture

### Prerequisites
*   **PowerShell 7+**
*   **Exchange Online Management Module:** `Get-Mailbox`, `Get-MailboxPermission`, `Get-RecipientPermission`.

### Logic Flow
1.  **Fetch Mailboxes:** Retrieve all recipients.
2.  **Iterate & Inspect:** For each mailbox, pull ACLs (Access Control Lists).
3.  **Enrich:** Resolve SIDs to User Names/Departments using Graph/Entra ID.
4.  **Analyze:** Apply rules (e.g., is Delegate active? is Delegate in same Dept?).
5.  **Output:** Stream to CSV.

## 🔮 Future Roadmap (The "Massive" Vision)
*   **Permission Baseline/Drift:** Establish a "Gold Standard" baseline (e.g., Executive Assistants only) and alert immediately on *drift* (new permissions added).
*   **Attestation Workflows:** Generate personalized HTML emails to Mailbox Owners: *"The following 3 people have access to your mailbox. Is this still required? [Yes/No]"*.
*   **Forensic Timeline:** Correlate permission grants with Audit Logs to show *when* and *who* granted the access originally.