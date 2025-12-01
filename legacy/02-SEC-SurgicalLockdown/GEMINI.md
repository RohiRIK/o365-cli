# Surgical Lockdown Module

## Context
This folder contains the high-risk "Emergency Kill Switch" for compromised accounts. Unlike "Graceful Offboarding," this protocol prioritizes security containment over data preservation.

## Scripts
*   **`Invoke-SurgicalLockdown.ps1`**: The emergency executor.
    *   **Type:** Action / Write (Modifies Tenant).
    *   **Input:** `UserPrincipalName` (Target), `IsolationComment`.
    *   **Output:** Console logs, CSV Action Report.

## Key Logic (Multi-Layered Defense)
1.  **Identity Layer:**
    *   Sets `AccountEnabled` to False.
    *   Revokes all SignInSessions (RefreshToken revocation).
    *   Scrambles the password to a random 64-character string.
2.  **Mobile Layer (Intune):**
    *   Issues a `Retire` command to iOS/Android devices. This performs a "Selective Wipe," removing corporate data while leaving personal data intact.
3.  **Endpoint Layer (Defender):**
    *   Issues an `Isolate` command to Windows devices. This cuts off network access (except to the MDE management channel).

## Operational Rules
*   **Simulation Default:** Uses `-ExecuteLive` switch. Defaults to simulation (Dry Run).
*   **Use Case:** Only use for active security threats (e.g., malware, insider threat, hostility).
*   **Dependencies:** `Microsoft.Graph` (Identity/Intune/Defender).
