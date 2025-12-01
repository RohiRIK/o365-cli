# External Sharing Audit Module

## Context
This folder is reserved for auditing external sharing links and guest access across SharePoint Online and OneDrive for Business.

## Planned Scripts
*   `Invoke-ExternalSharing_Audit.ps1` (Not yet implemented)

## Intended Scope
1.  **Link Analysis:** Identify "Anyone with the link" (Anonymous) and "Specific People" (Guest) sharing links.
2.  **Risk Assessment:** Flag sensitive files shared externally.
3.  **Expiration Check:** Identify sharing links that have no expiration date.

## Operational Rules
*   **Read-Only:** This module is primarily for reporting/auditing. Remediation should be handled carefully or via a separate process.
