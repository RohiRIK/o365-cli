# New User Onboarding Module

## Context
This folder is reserved for the "New User Onboarding" automation logic. Its goal is to standardize the provisioning process for new hires.

## Planned Scripts
*   `Invoke-NewUserOnboarding.ps1` (Not yet implemented)

## Intended Scope
1.  **Account Creation:** Standardized naming convention and attribute population (Department, Manager).
2.  **Group Membership:** Role-based assignment to default security groups and Teams.
3.  **License Assignment:** Automated assignment based on Department or Role.
4.  **Welcome Email:** Sending a secure welcome packet to the user's personal email.

## Operational Rules
*   **Idempotency:** The script should be safe to run multiple times on the same user (e.g., updating missing attributes without creating duplicates).
