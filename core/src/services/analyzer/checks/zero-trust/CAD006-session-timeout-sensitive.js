/**
 * CAD006: Session Timeout for Sensitive Apps
 *
 * Zero Trust pillar - Priority 2 (Important)
 *
 * Enforces shorter session lifetimes for high-value applications (HR systems,
 * financial apps, admin portals) to limit the window of opportunity for
 * session hijacking and unauthorized access.
 */
export function createCAD006Check(helpers) {
    return {
        id: "CAD006",
        name: "Session Timeout for Sensitive Apps",
        description: "Enforces short session lifetimes for high-value apps to limit hijacking window.",
        priority: 2,
        pillar: "Zero Trust",
        recommendation: "Set sign-in frequency to 1-4 hours for HR, finance, and admin applications.",
        remediationEffort: "low",
        whyItMatters: `
Default session lifetime (90 days) is too permissive for sensitive apps:
- HR systems (employee data, salaries, SSNs)
- Financial applications (QuickBooks, SAP, Oracle Financials)
- Admin portals (Azure, AWS, GCP consoles)
- Developer tools (GitHub, Jenkins, production access)

Session hijacking attack window:
- Default 90 days → Attacker has 3 months of access
- With 1 hour timeout → Attack window reduced 2,160x

Risk-based session controls:
- General apps: 8 hours (productivity balance)
- Sensitive apps: 1-4 hours (security priority)
- Admin portals: Already covered by CAU017 (4 hours)
- Critical systems: 1 hour + Continuous Access Evaluation (CAE)

Industry standards:
- PCI-DSS: 15 minutes for admin interfaces
- NIST 800-63B: Context-dependent, recommend 30 min - 12 hours
- HIPAA: Risk-based, typically 15-30 minutes for PHI access
`,
        references: [
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-session-lifetime",
            "https://www.pcisecuritystandards.org/document_library",
        ],
        implementationSteps: [
            "1. Identify high-value applications (HR, finance, developer tools)",
            "2. Create new CA policy: 'SESSION - Short Timeout for Sensitive Apps'",
            "3. Conditions → Cloud apps: Select sensitive applications",
            "4. Session controls → Sign-in frequency: 1-4 hours (based on app sensitivity)",
            "5. Session controls → Persistent browser session: 'Never'",
            "6. Enable in Report-Only mode for 1 week",
            "7. Communicate to users: Expect periodic re-authentication",
            "8. Monitor user experience feedback",
            "9. Switch to 'On'",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "SESSION - Short Timeout for Sensitive Apps",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"]
    },
    "applications": {
      "includeApplications": [
        "<workday-app-id>",         // HR system
        "<quickbooks-app-id>",      // Finance
        "<github-enterprise-app-id>" // Dev tools
      ]
    }
  },
  "sessionControls": {
    "signInFrequency": {
      "value": 2,
      "type": "hours",
      "isEnabled": true
    },
    "persistentBrowser": {
      "mode": "never"
    }
  }
}`,
        relatedChecks: ["CAU017", "CAD003"],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Look for app-specific session timeout policies
                const targetsSpecificApps = policy.conditions?.applications?.includeApplications &&
                    policy.conditions.applications.includeApplications.length > 0 &&
                    !policy.conditions.applications.includeApplications.includes("All");
                const hasSignInFrequency = policy.sessionControls?.signInFrequency !== null;
                if (targetsSpecificApps && hasSignInFrequency) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAD006", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
