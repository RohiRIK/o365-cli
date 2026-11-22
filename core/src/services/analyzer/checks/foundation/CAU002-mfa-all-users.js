/**
 * CAU002: Require MFA for All Users
 *
 * Foundation pillar - Priority 1 (Critical)
 *
 * Universal MFA enforcement is the single most effective control against
 * credential-based attacks. This check validates that MFA is required for
 * all users across all cloud applications.
 */
/**
 * CAU002 Baseline Check: Require MFA for All Users
 *
 * This check validates that your tenant requires MFA for all users across all applications.
 *
 * Required policy conditions:
 * - Targets: All users
 * - Apps: All cloud apps
 * - Grant control: Require multifactor authentication (or authentication strength)
 *
 * Why this matters:
 * - MFA blocks 99.9% of account compromise attempts (Microsoft Security report)
 * - Credential stuffing and password spray attacks are neutralized
 * - Cost-effective security control with massive impact
 */
export function createCAU002Check(helpers) {
    return {
        // ===== METADATA =====
        id: "CAU002",
        name: "Require MFA for All Users",
        description: "Enforcing MFA organization-wide blocks 99.9% of account compromise attempts.",
        priority: 1,
        pillar: "Foundation",
        recommendation: "Create a broad MFA policy targeting 'All Users' and 'All Cloud Apps'.",
        remediationEffort: "low",
        // ===== CONTEXT & GUIDANCE =====
        whyItMatters: `
Multi-factor authentication (MFA) is the foundational control for modern identity security.

Impact statistics:
- Blocks 99.9% of account compromise attempts (Microsoft Security)
- Stops credential stuffing, password spray, and phishing attacks
- Average breach cost without MFA: $4.62M vs $3.05M with MFA (IBM 2023)

Common attack vectors neutralized by MFA:
- Password spray attacks (automated credential guessing)
- Credential stuffing (using leaked password databases)
- Phishing attacks (stolen passwords are useless without 2nd factor)
- Brute force attacks

Without universal MFA, a single compromised password can lead to:
- Lateral movement within the organization
- Data exfiltration
- Ransomware deployment
- Business Email Compromise (BEC)
`,
        references: [
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-policy-all-users-mfa",
            "https://www.microsoft.com/en-us/security/business/security-insider/anatomy-of-external-attack-surfaces",
            "https://query.prod.cms.rt.microsoft.com/cms/api/am/binary/RE4Myp7",
        ],
        implementationSteps: [
            "1. Create new CA policy: 'GRANT - Require MFA for All Users'",
            "2. Conditions → Users: Include 'All users', Exclude 'Break-glass accounts'",
            "3. Conditions → Cloud apps: 'All cloud apps'",
            "4. Access controls → Grant: Select 'Require multifactor authentication'",
            "5. Enable policy → Start with 'Report-only mode' for 2 weeks",
            "6. Communicate MFA rollout to organization (provide setup guides)",
            "7. Monitor sign-in logs for users without MFA registered",
            "8. Run MFA registration campaign using Azure AD Identity Governance",
            "9. Switch to 'On' after validation period",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - Require MFA for All Users",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["mfa"]
  }
}`,
        relatedChecks: ["CAP001", "CAU012"], // Depends on legacy auth being blocked, and MFA registration being secure
        // ===== DETECTION LOGIC =====
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                // Skip disabled policies
                if (policy.state === "disabled")
                    continue;
                // Check if policy meets requirements:
                // 1. Targets all users
                // 2. Targets all apps
                // 3. Requires MFA (via mfa control or authentication strength)
                const targetsAllUsers = policy.conditions?.users?.includeUsers?.includes("All");
                const targetsAllApps = helpers.targetsApp(policy, "All");
                const requiresMFA = helpers.requiresMFA(policy);
                if (targetsAllUsers && targetsAllApps && requiresMFA) {
                    // Policy matches this check
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAU002", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
