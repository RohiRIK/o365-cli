/**
 * CAU012: MFA for Security Info Registration
 *
 * Foundation pillar - Priority 1 (Critical)
 *
 * The MFA registration process itself is a high-value target. Attackers who
 * compromise an account during the registration window can register their own
 * MFA device and lock out the legitimate user.
 */

import type { BaselineCheck, Policy, CheckHelpers } from "../types";
import type { PolicyMatch } from "../../ca-baseline";

export function createCAU012Check(helpers: CheckHelpers): BaselineCheck {
  return {
    id: "CAU012",
    name: "MFA for Security Info Registration",
    description: "Prevents attackers from hijacking the MFA enrollment process.",
    priority: 1,
    pillar: "Foundation",
    recommendation: "Target 'Register security information' action and require MFA.",
    remediationEffort: "low",

    whyItMatters: `
Attack scenario - MFA registration hijacking:

1. Attacker compromises user credentials (phishing, password spray)
2. User hasn't registered MFA yet (common in new deployments)
3. Attacker rushes to register THEIR MFA device before the user
4. Attacker now has persistent access even after password reset
5. Legitimate user is locked out ("MFA device already registered")

This creates a race condition during MFA rollout campaigns.

Protection strategy:
- Require existing MFA to register NEW MFA methods (chicken-egg problem)
- Use Temporary Access Pass (TAP) for initial MFA registration
- Restrict registration to trusted networks
- Monitor registration events for anomalies

Microsoft statistics:
- 15% increase in registration hijacking attempts during COVID remote work shift
- Average time to detect fraudulent MFA registration: 72 hours
`,

    references: [
      "https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-policy-registration",
      "https://learn.microsoft.com/en-us/entra/identity/authentication/howto-authentication-temporary-access-pass",
      "https://techcommunity.microsoft.com/t5/microsoft-entra-azure-ad-blog/protect-your-users-from-mfa-registration-attacks/ba-p/2363456",
    ],

    implementationSteps: [
      "1. Create new CA policy: 'GRANT - MFA for Security Info Registration'",
      "2. Conditions → Users: Include 'All users', Exclude 'Break-glass accounts'",
      "3. Conditions → User actions: Select 'Register security information'",
      "4. Access controls → Grant: 'Require multifactor authentication'",
      "5. IMPORTANT: Enable Temporary Access Pass (TAP) for initial MFA registration",
      "6. Configure TAP settings: Maximum lifetime 8 hours, one-time use",
      "7. Train helpdesk to issue TAP for new user MFA registration",
      "8. Enable policy (can enable immediately - TAP provides bootstrap)",
      "9. Monitor for registration events from untrusted locations",
    ],

    graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - MFA for Security Info Registration",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeUserActions": ["urn:user:registerdevice"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["mfa"]
  }
}

Note: Configure Temporary Access Pass separately:
POST https://graph.microsoft.com/v1.0/users/{userId}/authentication/temporaryAccessPassMethods
{
  "lifetimeInMinutes": 480,  // 8 hours
  "isUsableOnce": true
}`,

    relatedChecks: ["CAU002"],

    evaluate(policies: Policy[]): PolicyMatch[] {
      const matches: PolicyMatch[] = [];

      for (const policy of policies) {
        if (policy.state === "disabled") continue;

        // Check if policy targets security info registration and requires MFA
        const targetsRegistration = policy.conditions?.applications?.includeUserActions?.includes(
          "urn:user:registerdevice"
        );
        const requiresMFA = helpers.requiresMFA(policy);

        if (targetsRegistration && requiresMFA) {
          const isFullMatch = policy.state === "enabled";
          const policyMatch = helpers.createPolicyMatch(policy, "CAU012", isFullMatch);
          matches.push(policyMatch);
        }
      }

      return matches;
    },
  };
}
