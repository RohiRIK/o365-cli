# Guest User Lifecycle Module

## Context
This folder contains the logic for managing the lifecycle of External (Guest) users in the tenant. It is designed to automate cleanup while preventing data loss by ensuring asset handover.

## Scripts
*   **`Invoke-GuestCleanup_Action.ps1`**: The main engine.
    *   **Type:** Action / Write (Modifies Tenant).
    *   **Input:** Thresholds for Disable/Delete, Webhook URL for orphans.
    *   **Output:** Console logs, Webhook events.

## Key Logic
1.  **Whitelist:** Skips domains defined in `$ExcludedDomains`.
2.  **Staleness Logic:**
    *   **Disable:** Inactive > `$DaysToDisable` (Default: 90).
    *   **Delete:** Inactive > `$DaysToDelete` (Default: 180).
3.  **Asset Handover (Before Delete):**
    *   **Manager Check:** Looks for the `manager` attribute in Entra ID.
    *   **If Manager Found:** Grants them access to the guest's resources (Mailbox/OneDrive) if they exist.
    *   **If No Manager (Orphan):** Triggers a webhook (e.g., to Zapier/n8n) to alert IT for manual handling.

## Operational Rules
*   **Simulation Default:** Uses `-ExecuteLive` switch. Defaults to simulation (Dry Run).
*   **Dependencies:** `Microsoft.Graph` (Users/Managers), `ExchangeOnlineManagement` (Permissions).
