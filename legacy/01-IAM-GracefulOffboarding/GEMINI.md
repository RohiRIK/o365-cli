# Graceful Offboarding Module

## Context
This folder contains the standard automation logic for "Graceful Exit" employee terminations. It differs from "Surgical Lockdown" by focusing on data preservation and handover rather than immediate security containment.

## Scripts
*   **`Invoke-GracefulOffboarding_Action.ps1`**: The main executor.
    *   **Type:** Action / Write (Modifies Tenant).
    *   **Input:** `UserPrincipalName` (Leaver), `ManagerEmail` (Receiver).
    *   **Dependencies:** Requires both `Microsoft.Graph` (Identity/Licensing) and `ExchangeOnlineManagement` (Mailbox/GAL).

## Key Logic
1.  **Block Login:** Ensures `AccountEnabled` is false.
2.  **Mailbox Conversion:** Converts User Mailbox -> Shared Mailbox (Retains data for free <50GB).
3.  **GAL Hiding:** Sets `HiddenFromAddressListsEnabled` to true.
4.  **Handover:** Grants `FullAccess` permission to the specified Manager.
5.  **License Reclamation:** Removes all assigned licenses *after* mailbox conversion to ensure no data loss.

## Operational Rules
*   **Simulation Default:** Uses `-ExecuteLive` switch. Defaults to simulation (Dry Run).
*   **Timing:** Should be run *on* the termination date, typically after the user's last active hour.
