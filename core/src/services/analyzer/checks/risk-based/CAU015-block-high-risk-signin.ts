/**
 * CAU015: Block High-Risk Sign-ins
 *
 * Risk-Based pillar - Priority 2 (Important)
 *
 * Azure AD Identity Protection uses machine learning to detect impossible travel,
 * anonymous IP addresses, credential leaks, and other high-risk sign-in patterns.
 * Automatically blocking these signals prevents account takeover.
 */

import type { BaselineCheck, Policy, CheckHelpers } from "../types";
import type { PolicyMatch } from "../../ca-baseline";

export function createCAU015Check(helpers: CheckHelpers): BaselineCheck {
  return {
    id: "CAU015",
    name: "Block High-Risk Sign-ins",
    description: "Automatically blocks credential stuffing and impossible travel signals.",
    priority: 2,
    pillar: "Risk-Based",
    recommendation: "Create a policy to 'Block' access when 'Sign-in Risk' is High.",
    remediationEffort: "low",

    whyItMatters: `
Identity Protection uses Microsoft's threat intelligence to detect real-time attacks:
- Credential stuffing (testing leaked passwords from dark web)
- Impossible travel (sign-in from New York and London within 1 hour)
- Anonymous IP addresses (Tor, VPN exit nodes)
- Malware-linked IP addresses
- Unfamiliar sign-in properties

High-risk signals indicate active compromise - no user interaction should be allowed.

Requires: Azure AD Premium P2 or Microsoft 365 E5 licensing
`,

    references: [
      "https://learn.microsoft.com/en-us/entra/id-protection/howto-identity-protection-configure-risk-policies",
      "https://learn.microsoft.com/en-us/entra/id-protection/concept-identity-protection-risks",
    ],

    implementationSteps: [
      "1. Verify Azure AD Premium P2 licensing",
      "2. Enable Identity Protection (Entra → Protection → Identity Protection)",
      "3. Create new CA policy: 'BLOCK - High-Risk Sign-ins'",
      "4. Conditions → Sign-in risk: Select 'High'",
      "5. Conditions → Cloud apps: 'All cloud apps'",
      "6. Access controls → Block access",
      "7. Enable policy",
    ],

    graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "BLOCK - High-Risk Sign-ins",
  "state": "enabled",
  "conditions": {
    "signInRiskLevels": ["high"],
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"]
  }
}`,

    relatedChecks: ["CAU006", "CAU016"],

    evaluate(policies: Policy[]): PolicyMatch[] {
      const matches: PolicyMatch[] = [];

      for (const policy of policies) {
        if (policy.state === "disabled") continue;

        const hasHighRisk = policy.conditions?.signInRiskLevels?.includes("high");
        const blocksAccess = helpers.meetsGrantControls(policy, ["block"]);

        if (hasHighRisk && blocksAccess) {
          const isFullMatch = policy.state === "enabled";
          const policyMatch = helpers.createPolicyMatch(policy, "CAU015", isFullMatch);
          matches.push(policyMatch);
        }
      }

      return matches;
    },
  };
}
