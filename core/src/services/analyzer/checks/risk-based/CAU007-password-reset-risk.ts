/**
 * CAU007: Password Reset for High-Risk Users
 *
 * Risk-Based pillar - Priority 2 (Important)
 *
 * Allows high-risk users to self-remediate via secure password reset + MFA,
 * reducing helpdesk burden while maintaining security. Alternative to CAU016
 * for organizations preferring self-service remediation.
 */

import type { BaselineCheck, Policy, CheckHelpers } from "../types";
import type { PolicyMatch } from "../../ca-baseline";

export function createCAU007Check(helpers: CheckHelpers): BaselineCheck {
  return {
    id: "CAU007",
    name: "Password Reset for High-Risk Users",
    description: "Forces credential rotation when compromise signals are detected.",
    priority: 2,
    pillar: "Risk-Based",
    recommendation: "Require 'Password Change' and MFA for High User Risk.",
    remediationEffort: "medium",

    whyItMatters: `
Self-service remediation workflow:

1. User attempts sign-in → High user risk detected
2. User prompted to change password (must use strong password)
3. User must satisfy MFA challenge
4. User risk automatically downgraded after successful remediation

Benefits:
- Immediate remediation without helpdesk intervention
- Reduces mean time to remediate (MTTR) from days to minutes
- User maintains productivity
- Automatic risk score reset

Alternative to CAU016 (blocking):
- CAU016 = Block → Admin must reset password (higher security, lower productivity)
- CAU007 = Self-service reset → User resets own password (balanced approach)

Many organizations implement BOTH policies (CAU016 AND CAU007) for defense-in-depth.

Requires: Azure AD Premium P2 or Microsoft 365 E5 licensing
`,

    references: [
      "https://learn.microsoft.com/en-us/entra/id-protection/howto-identity-protection-configure-risk-policies",
      "https://learn.microsoft.com/en-us/entra/identity/authentication/concept-sspr-howitworks",
    ],

    implementationSteps: [
      "1. Enable Self-Service Password Reset (SSPR) for all users",
      "2. Configure SSPR to require 2 methods (email + phone, or authenticator app)",
      "3. Create new CA policy: 'GRANT - Password Reset for High-Risk Users'",
      "4. Conditions → User risk: Select 'High'",
      "5. Conditions → Cloud apps: 'All cloud apps'",
      "6. Access controls → Grant access → Require password change + MFA",
      "7. Enable policy",
      "8. Test with dummy account flagged as high risk",
    ],

    graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - Password Reset for High-Risk Users",
  "state": "enabled",
  "conditions": {
    "userRiskLevels": ["high"],
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "grantControls": {
    "operator": "AND",
    "builtInControls": ["passwordChange", "mfa"]
  }
}`,

    relatedChecks: ["CAU016"],

    evaluate(policies: Policy[]): PolicyMatch[] {
      const matches: PolicyMatch[] = [];

      for (const policy of policies) {
        if (policy.state === "disabled") continue;

        const hasHighRisk = policy.conditions?.userRiskLevels?.includes("high");
        const requiresPasswordChange = helpers.meetsGrantControls(policy, ["passwordChange"]);

        if (hasHighRisk && requiresPasswordChange) {
          const isFullMatch = policy.state === "enabled";
          const policyMatch = helpers.createPolicyMatch(policy, "CAU007", isFullMatch);
          matches.push(policyMatch);
        }
      }

      return matches;
    },
  };
}
