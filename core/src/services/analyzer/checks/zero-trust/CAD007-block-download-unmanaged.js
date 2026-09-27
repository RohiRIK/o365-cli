/**
 * CAD007: Block Download on Unmanaged Devices (SharePoint/OneDrive)
 *
 * Zero Trust pillar - Priority 3 (Recommended)
 *
 * Allows web-only access to SharePoint/OneDrive from unmanaged devices,
 * but blocks downloading, printing, or syncing files. Balances productivity
 * with data protection for BYOD scenarios.
 */
export function createCAD007Check(helpers) {
    return {
        id: "CAD007",
        name: "Block Download on Unmanaged Devices (SharePoint/OneDrive)",
        description: "Allows web-only SharePoint/OneDrive access but blocks download/sync on unmanaged devices.",
        priority: 3,
        pillar: "Zero Trust",
        recommendation: "Enable application-enforced restrictions for SharePoint on unmanaged devices.",
        remediationEffort: "low",
        whyItMatters: `
BYOD productivity vs security trade-off:
- Block SharePoint entirely → Users can't work from home (bad UX)
- Allow full access → Sensitive files on personal devices (bad security)
- Web-only access → View files but can't download (balanced approach)

Data exfiltration scenarios prevented:
- User downloads confidential files to personal laptop
- Personal laptop stolen → Unencrypted corporate data exposed
- User's home PC infected with malware → Files synced to OneDrive compromised
- Contractor downloads files before leaving company

Application-enforced restrictions (AER):
- Web browser access only (no desktop OneDrive sync)
- View documents in Office for Web (no download button)
- Printing disabled
- Copy/paste disabled (optional)
- External sharing blocked

User experience:
- ✅ Can read documents, spreadsheets, presentations
- ✅ Can collaborate in real-time (web editing)
- ❌ Cannot download files for offline access
- ❌ Cannot sync OneDrive folder to personal device
- ❌ Cannot print documents

Requires: SharePoint Online (included in M365 E3/E5)
`,
        references: [
            "https://learn.microsoft.com/en-us/sharepoint/control-access-from-unmanaged-devices",
            "https://learn.microsoft.com/en-us/sharepoint/app-enforced-restrictions",
        ],
        implementationSteps: [
            "1. Create new CA policy: 'SESSION - SharePoint Limited Access (Unmanaged)'",
            "2. Conditions → Cloud apps: 'Office 365 SharePoint Online'",
            "3. Conditions → Device state: Filter for unmanaged devices (NOT compliant, NOT domain-joined)",
            "4. Grant controls → Allow access (don't block entirely)",
            "5. Session controls → Use app enforced restrictions: Enabled",
            "6. Enable in Report-Only mode for 2 weeks",
            "7. Communicate to users: Personal device access limited to web-only",
            "8. Monitor user feedback and blocked download attempts",
            "9. Switch to 'On'",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "SESSION - SharePoint Limited Access (Unmanaged)",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"]
    },
    "applications": {
      "includeApplications": ["00000003-0000-0ff1-ce00-000000000000"]
    },
    "deviceStates": {
      "excludeStates": ["domainJoined", "compliant"]  // Only target unmanaged
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": []  // No additional requirements (allow access)
  },
  "sessionControls": {
    "applicationEnforcedRestrictions": {
      "isEnabled": true  // Enable SharePoint limited access mode
    }
  }
}`,
        relatedChecks: ["CAD004"],
        evaluate(policies) {
            const matches = [];
            // SharePoint Online app ID
            const sharepointAppId = "00000003-0000-0ff1-ce00-000000000000";
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Check if policy targets SharePoint with application-enforced restrictions
                const targetsSharePoint = helpers.targetsApp(policy, sharepointAppId);
                // Check for session controls (applicationEnforcedRestrictions)
                const hasAppRestrictions = policy.sessionControls?.applicationEnforcedRestrictions?.isEnabled === true;
                if (targetsSharePoint && hasAppRestrictions) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAD007", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
