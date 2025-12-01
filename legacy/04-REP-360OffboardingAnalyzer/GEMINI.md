# 360° Offboarding Analyzer Module

## Context
This folder contains the reporting engine for comprehensive user lifecycle analysis. It provides a holistic view of a user's digital footprint (Identity, Licenses, Devices, Group Memberships) to inform offboarding or cleanup decisions.

## Scripts
*   **`Invoke-Employee360_Report.ps1`**: The deep-dive scanner.
    *   **Type:** Reporting / Read-Only (No Write Action).
    *   **Input:** Configurable thresholds (`DaysToDisable`, `DaysToDelete`).
    *   **Output:** Detailed CSV Report.

## Key Logic (The "360" View)
1.  **Activity Analysis:** Calculates `DaysInactive` based on `SignInActivity` or creation date.
2.  **Asset Inventory:**
    *   **Licenses:** Lists all assigned SKUs.
    *   **Devices:** Lists all Intune/Entra joined devices owned by the user.
    *   **Groups:** Lists membership (crucial for finding owners of sensitive groups).
3.  **Risk Detection (Recommendations):**
    *   **Dormant Admin:** Flagging privileged accounts inactive > 30 days.
    *   **Stale Guest:** External users inactive > 90 days.
    *   **Orphans:** Internal users with no assigned Manager.
    *   **Hoarders:** Users with > 50 group memberships.
4.  **Lifecycle Phase Suggestion:**
    *   `DISABLE`: Active but inactive > Threshold.
    *   `DECOMMISSION`: Disabled and ready for license removal.
    *   `DELETE`: Disabled and inactive > Retention period (default 365 days).

## Operational Rules
*   **Safety:** This script is **Read-Only**. It does not modify any data.
*   **Parallel Processing:** Uses `ConcurrentBag` for high-performance scanning of large directories.
*   **Dependencies:** `Microsoft.Graph` (User, AuditLog, Device, Group).
