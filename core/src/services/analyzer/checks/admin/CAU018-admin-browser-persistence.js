/**
 * CAU018: Disable Browser Persistence for Admins
 *
 * Administration pillar - Priority 1 (Critical)
 *
 * Prevents "Stay signed in?" browser sessions for administrators, forcing
 * fresh authentication each time. Critical for shared/compromised devices.
 */
export function createCAU018Check(helpers) {
    return {
        id: "CAU018",
        name: "Disable Browser Persistence for Admins",
        description: "Prevents token theft on shared or compromised devices.",
        priority: 1,
        pillar: "Administration",
        recommendation: "Set 'Persistent Browser Session' to 'Never' for administrators.",
        remediationEffort: "low",
        whyItMatters: `
"Stay signed in?" feature creates persistent authentication tokens that survive:
- Browser restarts
- System reboots
- Extended idle periods

Attack scenarios:
- Admin uses public/shared computer (airport lounge, hotel business center)
- Admin's device is stolen or compromised
- Malware harvests persistent browser tokens

With persistence disabled:
- Browser must re-authenticate after closing
- Stolen device cannot leverage cached credentials
- Reduces forensic complexity (clear session boundaries)

Microsoft recommendation: NEVER allow persistent sessions for privileged accounts
Compliance: Required for NIST 800-63B Level 2 authentication
`,
        references: [
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-session-lifetime#persistent-browser-session",
            "https://pages.nist.gov/800-63-3/sp800-63b.html",
        ],
        implementationSteps: [
            "1. Create new CA policy: 'SESSION - Disable Browser Persistence for Admins'",
            "2. Conditions → Users → Select directory roles (all admin roles)",
            "3. Conditions → Cloud apps: 'All cloud apps'",
            "4. Session controls → Persistent browser session: 'Never persistent'",
            "5. Enable policy",
            "6. Communicate to admins: Expect to re-authenticate after browser restart",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "SESSION - Disable Browser Persistence for Admins",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeRoles": [
        "62e90394-69f5-4237-9190-012177145e10",  // Global Administrator
        "194ae4cb-b126-40b2-bd5b-6091b380977d"   // Security Administrator
      ],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "sessionControls": {
    "persistentBrowser": {
      "mode": "never",
      "isEnabled": true
    }
  }
}`,
        relatedChecks: ["CAU017"],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Check if policy targets admin roles and disables persistent browser
                const hasAdminRoles = policy.conditions?.users?.includeRoles &&
                    policy.conditions.users.includeRoles.length > 0;
                const disablesPersistence = policy.sessionControls?.persistentBrowser?.mode === "never";
                if (hasAdminRoles && disablesPersistence) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAU018", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
