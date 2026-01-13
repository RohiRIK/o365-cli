/**
 * CAU008: Require Phishing-Resistant MFA for Admins
 *
 * Foundation pillar - Priority 1 (Critical)
 *
 * Traditional MFA (SMS, phone call, push notifications) is vulnerable to
 * MFA fatigue attacks and SIM swapping. Phishing-resistant MFA (FIDO2, Passkeys,
 * Windows Hello for Business) provides cryptographic proof that cannot be phished.
 */
export function createCAU008Check(helpers) {
    return {
        id: "CAU008",
        name: "Require Phishing-Resistant MFA for Admins",
        description: "Prevents admin takeover via MFA fatigue or SIM swaps using FIDO2/Windows Hello.",
        priority: 1,
        pillar: "Foundation",
        recommendation: "Require 'Authentication Strength' (FIDO2/Passkey) for all administrator roles.",
        remediationEffort: "medium",
        whyItMatters: `
Traditional MFA methods are increasingly targeted:
- MFA fatigue attacks (push notification bombing)
- SIM swapping (intercepting SMS codes)
- Social engineering (phone call interception)

High-profile breaches using MFA bypass:
- Uber (2022) - MFA fatigue attack
- Twilio (2022) - SMS phishing
- LastPass (2022) - Compromised DevOps engineer

Phishing-resistant MFA uses cryptographic proof (FIDO2) that cannot be:
- Intercepted (no codes sent over network)
- Phished (private key never leaves device)
- Replayed (challenge-response protocol)

Microsoft recommendation: All privileged accounts must use passwordless or
phishing-resistant authentication (Zero Trust deployment guide).
`,
        references: [
            "https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-strengths",
            "https://learn.microsoft.com/en-us/entra/standards/memo-22-09-multi-factor-authentication",
            "https://www.microsoft.com/en-us/security/blog/2022/09/12/passwordless-authentication-with-fido2-keys",
        ],
        implementationSteps: [
            "1. Create Authentication Strength policy in Entra (Security → Protection → Authentication methods → Authentication strengths)",
            "2. Select 'Phishing-resistant MFA' strength (includes FIDO2, Windows Hello, Certificate-based auth)",
            "3. Create new CA policy: 'GRANT - Phishing-Resistant MFA for Admins'",
            "4. Conditions → Users: Include all directory roles (Global Admin, Security Admin, etc.)",
            "5. Conditions → Cloud apps: 'All cloud apps'",
            "6. Access controls → Grant: 'Require authentication strength' → Select phishing-resistant strength",
            "7. Distribute FIDO2 security keys to admin users (YubiKey, Titan, etc.)",
            "8. Ensure Windows Hello for Business is deployed for admin workstations",
            "9. Enable policy in Report-Only mode for 2 weeks",
            "10. Monitor adoption and provide registration support",
            "11. Switch to 'On'",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - Phishing-Resistant MFA for Admins",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeRoles": [
        "62e90394-69f5-4237-9190-012177145e10",  // Global Administrator
        "194ae4cb-b126-40b2-bd5b-6091b380977d",  // Security Administrator
        "f28a1f50-f6e7-4571-818b-6a12f2af6b6c"   // SharePoint Administrator
      ],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "authenticationStrength": {
      "id": "00000000-0000-0000-0000-000000000004"  // Phishing-resistant MFA
    }
  }
}`,
        relatedChecks: ["CAU002", "CAU009", "CAU017"],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Check if policy requires authentication strength for admin roles
                const hasAdminRoles = policy.conditions?.users?.includeRoles &&
                    policy.conditions.users.includeRoles.length > 0;
                const hasAuthStrength = policy.grantControls?.authenticationStrength !== null;
                if (hasAdminRoles && hasAuthStrength) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAU008", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
