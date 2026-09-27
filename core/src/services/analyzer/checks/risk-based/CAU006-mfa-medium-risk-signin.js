/**
 * CAU006: Require MFA for Medium/High-Risk Sign-ins
 *
 * Risk-Based pillar - Priority 2 (Important)
 *
 * Challenges suspicious activity with MFA instead of outright blocking,
 * balancing security with user productivity. Medium-risk signals may indicate
 * legitimate travel or new device usage.
 */
export function createCAU006Check(helpers) {
    return {
        id: "CAU006",
        name: "Require MFA for Medium/High-Risk Sign-ins",
        description: "Challenges suspicious activity without blocking legitimate users.",
        priority: 2,
        pillar: "Risk-Based",
        recommendation: "Require MFA when 'Sign-in Risk' is Medium or High.",
        remediationEffort: "low",
        whyItMatters: `
Medium-risk signals may be false positives (legitimate travel, new device):
- Travel patterns that are unusual but plausible
- New device registration from known location
- Sign-in from residential IP vs corporate network

MFA provides step-up authentication without frustrating legitimate users.
If the user can satisfy MFA, the session proceeds normally.

Requires: Azure AD Premium P2 or Microsoft 365 E5 licensing
`,
        references: [
            "https://learn.microsoft.com/en-us/entra/id-protection/howto-identity-protection-configure-risk-policies",
        ],
        implementationSteps: [
            "1. Create new CA policy: 'GRANT - MFA for Medium/High Risk Sign-ins'",
            "2. Conditions → Sign-in risk: Select 'Medium' and 'High'",
            "3. Conditions → Cloud apps: 'All cloud apps'",
            "4. Access controls → Require multifactor authentication",
            "5. Enable policy",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - MFA for Medium/High Risk Sign-ins",
  "state": "enabled",
  "conditions": {
    "signInRiskLevels": ["medium", "high"],
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["mfa"]
  }
}`,
        relatedChecks: ["CAU015"],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                const hasMediumRisk = policy.conditions?.signInRiskLevels?.includes("medium");
                const requiresMFA = helpers.requiresMFA(policy);
                if (hasMediumRisk && requiresMFA) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAU006", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
