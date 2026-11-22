/**
 * CAU016: Block High-Risk Users
 *
 * Risk-Based pillar - Priority 2 (Important)
 *
 * User risk (vs sign-in risk) indicates the account itself is likely compromised
 * based on leaked credentials, dark web intelligence, or behavioral analysis.
 * This requires administrative remediation, not just MFA.
 */

import type { BaselineCheck, Policy, CheckHelpers } from "../types";
import type { PolicyMatch } from "../../ca-baseline";

export function createCAU016Check(helpers: CheckHelpers): BaselineCheck {
  return {
    id: "CAU016",
    name: "Block High-Risk Users",
    description: "Prevents access from compromised accounts detected in dark web dumps.",
    priority: 2,
    pillar: "Risk-Based",
    recommendation: "Create a policy to 'Block' access when 'User Risk' is High.",
    remediationEffort: "low",

    whyItMatters: `
User risk vs Sign-in risk:
- Sign-in risk = suspicious authentication attempt (may be legitimate user)
- User risk = account credentials are compromised (requires admin intervention)

High user risk indicators:
- Password found in dark web credential dumps
- Behavioral anomalies (data exfiltration patterns)
- Confirmed compromise signals from Microsoft security graph

Users with high risk should be forced through self-service password reset (see CAU007)
or admin-initiated password reset. Blocking until remediation prevents lateral movement.

Requires: Azure AD Premium P2 or Microsoft 365 E5 licensing
`,

    references: [
      "https://learn.microsoft.com/en-us/entra/id-protection/concept-identity-protection-risks#user-risk",
      "https://learn.microsoft.com/en-us/entra/id-protection/howto-identity-protection-configure-risk-policies",
    ],

    implementationSteps: [
      "1. Create new CA policy: 'BLOCK - High-Risk Users'",
      "2. Conditions → User risk: Select 'High'",
      "3. Conditions → Cloud apps: 'All cloud apps'",
      "4. Access controls → Block access",
      "5. Enable policy",
      "6. Configure user risk remediation workflow (see CAU007)",
    ],

    graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "BLOCK - High-Risk Users",
  "state": "enabled",
  "conditions": {
    "userRiskLevels": ["high"],
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"]
  }
}`,

    relatedChecks: ["CAU007"],

    evaluate(policies: Policy[]): PolicyMatch[] {
      const matches: PolicyMatch[] = [];

      for (const policy of policies) {
        if (policy.state === "disabled") continue;

        const hasHighRisk = policy.conditions?.userRiskLevels?.includes("high");
        const blocksAccess = helpers.meetsGrantControls(policy, ["block"]);

        if (hasHighRisk && blocksAccess) {
          const isFullMatch = policy.state === "enabled";
          const policyMatch = helpers.createPolicyMatch(policy, "CAU016", isFullMatch);
          matches.push(policyMatch);
        }
      }

      return matches;
    },
  };
}
