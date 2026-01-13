/**
 * CAD004: Require Compliant Device for SharePoint/OneDrive
 *
 * Zero Trust pillar - Priority 3 (Recommended)
 *
 * SharePoint and OneDrive contain the most sensitive corporate data.
 * Requiring device compliance for these apps (beyond general Office 365)
 * provides defense-in-depth for intellectual property and confidential files.
 */
export function createCAD004Check(helpers) {
    return {
        id: "CAD004",
        name: "Require Compliant Device for SharePoint/OneDrive",
        description: "Enforces device compliance specifically for file storage apps with sensitive data.",
        priority: 3,
        pillar: "Zero Trust",
        recommendation: "Create a dedicated policy requiring compliant devices for SharePoint and OneDrive access.",
        remediationEffort: "medium",
        whyItMatters: `
SharePoint/OneDrive contain highest-value data:
- Financial reports, contracts, M&A documents
- Source code repositories
- Customer data, PII, PHI
- Intellectual property, trade secrets

Why app-specific controls matter:
- Email compromise ≠ file storage compromise (separate attack paths)
- Downloaded files persist on unmanaged devices
- Offline sync = data exfiltration risk
- External sharing amplifies exposure

Defense-in-depth strategy:
- CAD001 (Office 365 compliance) provides baseline
- CAD004 (SharePoint/OneDrive) adds extra protection
- Layered controls reduce blast radius of compromise

Requires: Microsoft Intune (included in M365 E3/E5, EMS E3/E5)
`,
        references: [
            "https://learn.microsoft.com/en-us/sharepoint/control-access-from-unmanaged-devices",
            "https://learn.microsoft.com/en-us/mem/intune/protect/conditional-access-intune-common-ways-use",
        ],
        implementationSteps: [
            "1. Ensure device compliance policies exist (Intune → Devices → Compliance policies)",
            "2. Identify SharePoint app ID: 00000003-0000-0ff1-ce00-000000000000",
            "3. Create new CA policy: 'GRANT - Compliant Devices for SharePoint/OneDrive'",
            "4. Conditions → Cloud apps: Select 'Office 365 SharePoint Online'",
            "5. Access controls → Require device compliance OR Hybrid Azure AD joined",
            "6. Enable in Report-Only mode for 2 weeks",
            "7. Communicate to users: Enroll BYOD devices or use web-only access",
            "8. Configure SharePoint limited access for unmanaged devices (web-only, no download)",
            "9. Switch to 'On'",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - Compliant Devices for SharePoint/OneDrive",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["00000003-0000-0ff1-ce00-000000000000"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["compliantDevice", "domainJoinedDevice"]
  },
  "sessionControls": {
    "applicationEnforcedRestrictions": {
      "isEnabled": true  // Enforces SharePoint limited access for non-compliant
    }
  }
}`,
        relatedChecks: ["CAD001"],
        evaluate(policies) {
            const matches = [];
            // SharePoint Online app ID
            const sharepointAppId = "00000003-0000-0ff1-ce00-000000000000";
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Check if policy targets SharePoint specifically
                const targetsSharePoint = helpers.targetsApp(policy, sharepointAppId);
                // Requires device compliance
                const requiresCompliance = helpers.meetsGrantControls(policy, ["compliantDevice", "domainJoinedDevice"], "ANY");
                if (targetsSharePoint && requiresCompliance) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAD004", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
