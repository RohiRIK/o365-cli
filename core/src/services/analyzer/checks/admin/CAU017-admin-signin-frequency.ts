/**
 * CAU017: Limit Admin Sign-in Frequency
 *
 * Administration pillar - Priority 1 (Critical)
 *
 * Forces administrators to re-authenticate every few hours, preventing
 * session hijacking and limiting the blast radius of stolen session tokens.
 */

import type { BaselineCheck, Policy, CheckHelpers } from "../types";
import type { PolicyMatch } from "../../ca-baseline";

export function createCAU017Check(helpers: CheckHelpers): BaselineCheck {
  return {
    id: "CAU017",
    name: "Limit Admin Sign-in Frequency",
    description: "Forces re-authentication to prevent long-lived session hijacking.",
    priority: 1,
    pillar: "Administration",
    recommendation: "Set 'Sign-in Frequency' to 4 hours for all administrative roles.",
    remediationEffort: "low",

    whyItMatters: `
Session token theft attack scenarios:
- Browser cookie hijacking (XSS, session fixation)
- Pass-the-cookie attacks (Mimikatz, token replay)
- Device theft (stolen laptop with active admin session)

Default session lifetime: 90 days (unacceptable for privileged accounts)

With sign-in frequency set to 4 hours:
- Stolen session tokens expire quickly (limited damage window)
- Admin must re-authenticate periodically (liveness check)
- Reduces blast radius of compromise

Microsoft recommendation: 4-8 hours for administrative roles
Industry standard: 1-4 hours for privileged access (PCI-DSS, NIST)
`,

    references: [
      "https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-session-lifetime",
      "https://learn.microsoft.com/en-us/security/privileged-access-workstations/privileged-access-deployment",
    ],

    implementationSteps: [
      "1. Create new CA policy: 'SESSION - Limit Admin Sign-in Frequency'",
      "2. Conditions → Users → Select directory roles (Global Admin, Security Admin, etc.)",
      "3. Conditions → Cloud apps: 'All cloud apps'",
      "4. Session controls → Sign-in frequency: '4 hours'",
      "5. Enable policy",
      "6. Communicate to admins: Expect periodic re-authentication",
    ],

    graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "SESSION - Limit Admin Sign-in Frequency",
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
    "signInFrequency": {
      "value": 4,
      "type": "hours",
      "isEnabled": true
    }
  }
}`,

    relatedChecks: ["CAU018", "CAU008"],

    evaluate(policies: Policy[]): PolicyMatch[] {
      const matches: PolicyMatch[] = [];

      for (const policy of policies) {
        if (policy.state === "disabled") continue;

        // Check if policy targets admin roles and configures sign-in frequency
        const hasAdminRoles =
          policy.conditions?.users?.includeRoles &&
          policy.conditions.users.includeRoles.length > 0;
        const hasSignInFrequency = policy.sessionControls?.signInFrequency !== null;

        if (hasAdminRoles && hasSignInFrequency) {
          const isFullMatch = policy.state === "enabled";
          const policyMatch = helpers.createPolicyMatch(policy, "CAU017", isFullMatch);
          matches.push(policyMatch);
        }
      }

      return matches;
    },
  };
}
