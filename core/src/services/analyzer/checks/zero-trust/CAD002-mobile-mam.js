/**
 * CAD002: Require App Protection (MAM) for Mobile
 *
 * Zero Trust pillar - Priority 3 (Recommended)
 *
 * Protects corporate data on BYOD mobile devices using Mobile Application
 * Management (MAM) without requiring full device enrollment. Prevents
 * copy/paste to personal apps, enforces app-level PINs, and enables remote wipe.
 */
export function createCAD002Check(helpers) {
    return {
        id: "CAD002",
        name: "Require App Protection (MAM) for Mobile",
        description: "Protects corporate data on BYOD mobile devices.",
        priority: 3,
        pillar: "Zero Trust",
        recommendation: "Require 'Approved Client App' and 'App Protection Policy' for iOS/Android.",
        remediationEffort: "high",
        whyItMatters: `
Mobile Application Management (MAM) enables BYOD without MDM:
- App-level data protection (corporate data in Outlook isolated from personal Gmail)
- Conditional copy/paste (prevents exfiltration to personal apps)
- App-level PIN (separate from device PIN)
- Remote wipe of corporate data only (preserves personal photos/apps)

Common MAM scenarios:
- Contractor accessing email on personal iPhone (no full device enrollment)
- Executive using personal Android tablet for OneDrive access
- BYOD program without invasive MDM

Requires: Microsoft Intune App Protection Policies (included in M365 E3/E5, EMS E3/E5)

Approved client apps with MAM support:
- Microsoft Outlook, Teams, Edge, OneDrive, Word, Excel, PowerPoint
`,
        references: [
            "https://learn.microsoft.com/en-us/mem/intune/apps/app-protection-policy",
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-policy-approved-app-or-app-protection",
        ],
        implementationSteps: [
            "1. Create App Protection Policies in Intune (iOS and Android)",
            "2. Configure data protection settings (block save-as, encrypt, require PIN)",
            "3. Assign policies to user groups",
            "4. Create new CA policy: 'GRANT - App Protection for Mobile'",
            "5. Conditions → Platforms: Include 'iOS' and 'Android'",
            "6. Conditions → Cloud apps: 'Office 365' (or specific apps)",
            "7. Access controls → Grant access → Require approved client app AND Require app protection policy",
            "8. Enable in Report-Only mode for 4 weeks",
            "9. Communicate to users: Download Outlook/Teams from app store, sign in with work account",
            "10. Switch to 'On'",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - App Protection for Mobile",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["Office365"]
    },
    "platforms": {
      "includePlatforms": ["iOS", "android"]
    }
  },
  "grantControls": {
    "operator": "AND",
    "builtInControls": ["approvedApplication", "compliantApplication"]
  }
}`,
        relatedChecks: ["CAD001"],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Check if policy targets mobile platforms
                const platforms = policy.conditions?.platforms?.includePlatforms || [];
                const targetsMobile = platforms.includes("ios") || platforms.includes("all");
                // Accepts EITHER compliantApplication OR approvedApplication (ANY mode)
                const requiresMAM = helpers.meetsGrantControls(policy, ["compliantApplication", "approvedApplication"], "ANY");
                if (targetsMobile && requiresMAM) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAD002", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
