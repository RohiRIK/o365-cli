/**
 * CAU001: Require MFA for All Guests
 *
 * Guest/External pillar - Priority 2 (Important)
 *
 * Prevents partner/vendor compromise from cascading into your tenant.
 * Guest accounts have access to Teams, SharePoint, and other collaborative
 * resources, making them attractive targets.
 */

import type { BaselineCheck, Policy, CheckHelpers } from "../types";
import type { PolicyMatch } from "../../ca-baseline";

export function createCAU001Check(helpers: CheckHelpers): BaselineCheck {
  return {
    id: "CAU001",
    name: "Require MFA for All Guests",
    description: "Prevents partner compromise from spilling over into your tenant.",
    priority: 2,
    pillar: "Guest/External",
    recommendation: "Create a policy targeting 'All Guest and External Users' requiring MFA.",
    remediationEffort: "low",

    whyItMatters: `
Guest user attack scenarios:
- Partner organization gets breached → Guest credentials leaked
- Contractor's personal email compromised → Access to your Teams/SharePoint
- Vendor account takeover → Data exfiltration via shared folders

Guest users typically have access to:
- Teams channels and chat history
- SharePoint sites and document libraries
- Planner, Forms, and other collaboration tools
- Email forwarding and distribution lists

Without MFA:
- Compromised partner credentials grant immediate access
- No visibility into partner's security posture
- Lateral movement from partner breach to your data

Industry statistics:
- 29% of breaches originate from compromised partner accounts (Verizon DBIR)
- Average time to detect guest account abuse: 197 days (Ponemon Institute)

Microsoft recommendation: Require MFA for all external identities (B2B Collaboration Guide)
`,

    references: [
      "https://learn.microsoft.com/en-us/entra/external-id/authentication-conditional-access",
      "https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-policy-all-users-mfa#create-a-conditional-access-policy",
    ],

    implementationSteps: [
      "1. Create new CA policy: 'GRANT - Require MFA for Guests'",
      "2. Conditions → Users: Select 'All guest and external users'",
      "3. Conditions → Cloud apps: 'All cloud apps'",
      "4. Access controls → Grant: 'Require multifactor authentication'",
      "5. Important: Guests will use their HOME tenant's MFA (not yours)",
      "6. Enable in Report-Only mode for 2 weeks",
      "7. Communicate to partners: MFA will be required starting [date]",
      "8. Switch to 'On'",
    ],

    graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - Require MFA for Guests",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeGuestsOrExternalUsers": {
        "guestOrExternalUserTypes": "b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser",
        "externalTenants": {
          "membershipKind": "all"
        }
      }
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

    relatedChecks: ["CAU001A", "CAU002"],

    evaluate(policies: Policy[]): PolicyMatch[] {
      const matches: PolicyMatch[] = [];

      for (const policy of policies) {
        if (policy.state === "disabled") continue;

        // Check if policy targets guests/external users and requires MFA
        const targetsGuests = policy.conditions?.users?.includeGuestsOrExternalUsers !== null;
        const requiresMFA = helpers.requiresMFA(policy);

        if (targetsGuests && requiresMFA) {
          const isFullMatch = policy.state === "enabled";
          const policyMatch = helpers.createPolicyMatch(policy, "CAU001", isFullMatch);
          matches.push(policyMatch);
        }
      }

      return matches;
    },
  };
}
