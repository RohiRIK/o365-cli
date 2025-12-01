# Teams Activity Report Module

## Context
This folder is reserved for analyzing Microsoft Teams usage, focusing on inactive teams and guest access within teams.

## Planned Scripts
*   `Invoke-TeamsActivity_Report.ps1` (Not yet implemented)

## Intended Scope
1.  **Team Lifecycle:** Identify "Zombie Teams" (No activity > 90 days).
2.  **Guest Review:** List external guests per Team.
3.  **Ownerless Teams:** Flag Teams that have no valid owners.

## Operational Rules
*   **Dependencies:** Will require `Microsoft.Graph` (Teams/Groups endpoints).
