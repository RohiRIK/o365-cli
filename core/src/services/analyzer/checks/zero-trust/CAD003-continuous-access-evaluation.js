/**
 * CAD003: Enable Continuous Access Evaluation (CAE)
 *
 * Zero Trust pillar - Priority 3 (Recommended)
 *
 * CAE provides real-time session revocation when critical events occur
 * (password change, user deletion, IP change). Without CAE, access tokens
 * remain valid for up to 24 hours even after account compromise.
 */
export function createCAD003Check(helpers) {
    return {
        id: "CAD003",
        name: "Enable Continuous Access Evaluation (CAE)",
        description: "Enables real-time session revocation on password change, user deletion, or IP change.",
        priority: 3,
        pillar: "Zero Trust",
        recommendation: "Enable CAE for all users and CAE-capable applications (Office 365, Teams, SharePoint).",
        remediationEffort: "low",
        whyItMatters: `
Default token lifetime problem:
- Access tokens valid for 1-24 hours (even after password reset!)
- User deleted → Sessions remain active until token expires
- IP address changes (travel) → No reauthentication required
- Password compromised → Attacker has hours of access

CAE solves this with near-instant revocation:
- Password reset → All sessions terminated within minutes
- User disabled → Immediate access revocation
- Location change → Reauthentication required
- Critical events → Real-time policy enforcement

CAE-enabled apps (as of 2024):
- Microsoft 365 (Outlook, Word, Excel, PowerPoint)
- Microsoft Teams
- SharePoint Online, OneDrive
- Exchange Online
- Microsoft Graph API calls

Requires: Azure AD Premium P1, CAE-capable applications
`,
        references: [
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-continuous-access-evaluation",
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-continuous-access-evaluation-policy",
        ],
        implementationSteps: [
            "1. Verify licensing: Azure AD Premium P1 or higher",
            "2. Enable CAE at tenant level (Entra → Security → Continuous access evaluation)",
            "3. CAE is automatically enabled for supported apps - no CA policy needed",
            "4. Optionally: Create CA policy to enforce session lifetime for non-CAE apps",
            "5. Test: Reset user password, verify sessions terminated immediately",
            "6. Monitor: Review sign-in logs for CAE enforcement events",
        ],
        graphApiExample: `
# CAE is enabled at tenant level, not via CA policy
# However, you can create a policy for session controls on non-CAE apps:

POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "SESSION - Strict Lifetime for Non-CAE Apps",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeUsers": ["All"]
    },
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "sessionControls": {
    "signInFrequency": {
      "value": 1,
      "type": "hours",
      "isEnabled": true
    },
    "persistentBrowser": {
      "mode": "never"
    }
  }
}

# Enable CAE via tenant settings (PowerShell):
# Connect-MgGraph -Scopes "Policy.ReadWrite.ConditionalAccess"
# Update-MgPolicyAuthenticationMethodPolicy -IsContinuousAccessEvaluationEnabled $true
`,
        relatedChecks: ["CAU017"],
        evaluate(policies) {
            const matches = [];
            // CAE is a tenant-level setting, not enforced via CA policy
            // We check for session control policies that complement CAE
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                const hasSessionControls = policy.sessionControls?.signInFrequency !== null ||
                    policy.sessionControls?.persistentBrowser !== null;
                if (hasSessionControls) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAD003", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            // Note: This check is best validated via tenant configuration API, not CA policies
            // For now, we pass if ANY session control policy exists (proxy indicator)
            return matches;
        },
    };
}
