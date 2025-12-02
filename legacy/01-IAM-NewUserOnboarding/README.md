# New User Onboarding Orchestrator (IAM-01-N)

## 🚀 Vision & Purpose
The **New User Onboarding Orchestrator** transforms the chaotic "Day 1" experience into a streamlined, professional, and error-free launch. It replaces manual ticket processing with a **Code-as-Infrastructure** approach to identity creation.

This module ensures that every new hire arrives to a fully provisioned digital workspace: Account created, licenses assigned, groups populated, and welcome emails sent—**before they even drink their first coffee.**

## 💎 Key Features & Capabilities

### 🏭 Identity Factory
*   **Standardized Naming Convention:** Enforces strict UPN and Display Name patterns (e.g., `First.Last@company.com`) to prevent directory clutter. Handles duplicates automatically (e.g., `John.Smith2`).
*   **Attribute Hydration:** Populates critical downstream attributes (`Department`, `JobTitle`, `EmployeeID`, `Manager`) essential for Dynamic Groups and GAL searches.
*   **Password Generation:** Creates complex, compliant temporary passwords (or Temporary Access Passes) securely.

### 🎫 Resource Provisioning
*   **Role-Based Licensing (RBAC):**
    *   Assigns licenses based on `Department` or `JobRole`.
    *   *Example:* "Sales" gets `E5 + CRM`, "Engineering" gets `E5 + GitHub Ent`.
*   **Group Membership Engine:**
    *   Adds users to default "All Staff" security groups.
    *   Adds users to functional teams (e.g., "Marketing Team", "US Employees").
*   **Mailbox Warmup:** Pre-configures language, time zone, and signature settings for Exchange Online mailboxes.

### 📨 Day 1 Experience
*   **The "Welcome Packet":**
    *   Sends a beautifully formatted HTML email to the user's *personal* address (and their manager).
    *   Contains: Credentials, First-Time Login Instructions, Links to IT Policy, and Support Contacts.
*   **Manager Notification:** Alerts the hiring manager that IT setup is complete and provides a checklist for their first day.

## 🛠️ Technical Architecture

### Inputs (CSV or JSON)
The script consumes a standardized feed (from HRIS or CSV):
```json
{
  "FirstName": "Jane",
  "LastName": "Doe",
  "Department": "Engineering",
  "ManagerUPN": "cto@company.com",
  "PersonalEmail": "jane.doe@gmail.com"
}
```

### Execution Logic
1.  **Sanitize:** Validate inputs, check for existing users.
2.  **Create:** POST to Graph API `/users`.
3.  **License:** Assign `assignedLicenses`.
4.  **Group:** Add to AAD Groups.
5.  **Exchange:** Trigger remote provisioning.
6.  **Notify:** SMTP send to personal email.

## 🔮 Future Roadmap (The "Massive" Vision)
*   **Hardware Procurement Link:** Automatically trigger a ticket in the procurement system (Jira/ServiceNow) to ship a laptop based on the User's Role profile.
*   **Intune Autopilot Pre-Assignment:** Assign the specific user to a specific Autopilot device serial number so their "White Glove" OOBE experience is personalized "Welcome, Jane!".
*   **Identity Lifecycle Hooks:** Webhooks to trigger account creation in non-Microsoft systems (Slack, Zoom, Trello, AWS) immediately upon Entra ID creation.
*   **Temporary Access Pass (TAP) Only:** Move to a purely passwordless onboarding flow by generating TAPs and sending them via SMS.