# Stale Device Cleanup Module

## Context
This folder contains logic for maintaining hygiene in Entra ID (Azure AD) device records. It removes old, unused devices to improve security posture and reporting accuracy.

## Scripts
*   **`Invoke-StaleDevice_Cleanup.ps1`**: The main engine.
    *   **Type:** Action / Write (Modifies Tenant).
    *   **Input:** `TargetTrustType` (AzureAd, Workplace, ServerAd), `DaysInactive`.
    *   **Output:** CSV Report, Deletion Actions.

## Key Logic
1.  **TrustType Awareness:** Filters devices based on how they are registered.
    *   `AzureAd`: Cloud-only joined.
    *   `Workplace`: Personal devices (BYOD) registered via "Add Work Account".
    *   `ServerAd`: Hybrid joined (Synced from On-Prem AD). *Excluded by default to prevent sync loops.*
2.  **Autopilot Protection:** Explicitly checks `PhysicalIds` for `[ZTDId]` to ensure Autopilot records (which often appear inactive before deployment) are **never** deleted.
3.  **Staleness Check:**
    *   Flags devices inactive > `$DaysInactive` (Default: 90).
    *   Flags devices created > 30 days ago that *never* signed in.

## Operational Rules
*   **Simulation Default:** Uses `-ExecuteLive` switch. Defaults to simulation (Dry Run).
*   **Hybrid Caution:** Do NOT delete `ServerAd` (Hybrid) devices from the cloud. They must be deleted from On-Prem AD first, or they will simply re-sync (Zombie devices).
