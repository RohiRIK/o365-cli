# Mailbox Permissions Audit Module

## Context
This folder is reserved for auditing sensitive mailbox permissions (FullAccess, SendAs) to detect potential lateral movement paths or unauthorized access.

## Planned Scripts
*   `Invoke-MailboxPermissions_Audit.ps1` (Not yet implemented)

## Intended Scope
1.  **Delegation Audit:** List all mailboxes where non-owners have access.
2.  **Non-Personal Accounts:** Audit access to Shared Mailboxes and Resource Mailboxes.
3.  **Anomaly Detection:** Flag cross-departmental access or access by disabled accounts.

## Operational Rules
*   **Dependencies:** Will require `ExchangeOnlineManagement` module.
