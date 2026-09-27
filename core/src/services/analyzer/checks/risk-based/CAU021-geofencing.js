/**
 * CAU021: Geofencing - Block Untrusted Countries
 *
 * Risk-Based pillar - Priority 2 (Important)
 *
 * Blocks authentication from countries where your organization has no
 * business presence or users. Reduces attack surface from nation-state
 * actors and international cybercrime operations.
 */
export function createCAU021Check(helpers) {
    return {
        id: "CAU021",
        name: "Geofencing - Block Untrusted Countries",
        description: "Blocks authentication from countries where organization has no presence.",
        priority: 2,
        pillar: "Risk-Based",
        recommendation: "Create a Named Location with allowed countries and block access from all others.",
        remediationEffort: "medium",
        whyItMatters: `
Geographic access control reduces attack surface:
- Nation-state threat actors (APT groups)
- International cybercrime operations
- Credential stuffing botnets in Eastern Europe/Asia
- Ransomware operators in sanctioned countries

Common threat geography (based on Microsoft Security Intelligence):
- Top 5 attack origins: Russia, China, Iran, North Korea, Vietnam
- 60% of BEC attacks originate from Nigeria
- 80% of password spray attacks from Eastern Europe

Implementation considerations:
- Identify legitimate user travel patterns
- Allow countries with offices, remote workers, partners
- Consider supply chain dependencies (vendors, contractors)
- Provide exception process for business travel

Requires: Azure AD Premium P1 (Named Locations feature)
`,
        references: [
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/location-condition#named-locations",
            "https://www.microsoft.com/en-us/security/business/security-insider/reports/cyber-signals-defending-against-cyber-threats-originating-in-china",
        ],
        implementationSteps: [
            "1. Audit sign-in logs: Identify legitimate countries (last 90 days)",
            "2. Create Named Location: 'Allowed Countries' (select country codes)",
            "3. Add countries with: Offices, Remote workers, Common travel destinations, Key partners",
            "4. Create new CA policy: 'BLOCK - Untrusted Geographic Locations'",
            "5. Conditions → Locations: Include 'All locations', Exclude 'Allowed Countries'",
            "6. Access controls → Block access",
            "7. Enable in Report-Only mode for 4 weeks",
            "8. Monitor blocked attempts - adjust allowed countries as needed",
            "9. Document exception process for business travel",
            "10. Switch to 'On'",
        ],
        graphApiExample: `
# Step 1: Create Named Location with allowed countries
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/namedLocations
{
  "displayName": "Allowed Countries",
  "@odata.type": "#microsoft.graph.countryNamedLocation",
  "countriesAndRegions": ["US", "CA", "GB", "DE", "FR", "AU"],
  "includeUnknownCountriesAndRegions": false
}

# Step 2: Create blocking policy
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "BLOCK - Untrusted Geographic Locations",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "locations": {
      "includeLocations": ["All"],
      "excludeLocations": ["<allowed-countries-location-id>", "AllTrusted"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"]
  }
}`,
        relatedChecks: ["CAU020"],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Look for geofencing policies (location-based blocking)
                const hasLocationFilter = policy.conditions?.locations?.includeLocations?.includes("All") &&
                    policy.conditions?.locations?.excludeLocations &&
                    policy.conditions.locations.excludeLocations.length > 0;
                const blocksAccess = helpers.meetsGrantControls(policy, ["block"]);
                if (hasLocationFilter && blocksAccess) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAU021", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
