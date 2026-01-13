/**
 * CAU009: Require MFA for Admin Portals
 *
 * Foundation pillar - Priority 1 (Critical)
 *
 * Protects privileged access to Azure Portal, Microsoft 365 Admin Center,
 * Intune, and Entra admin portals. Admin accounts are high-value targets
 * and require additional protection beyond general user MFA.
 */

import type { BaselineCheck, Policy, CheckHelpers } from "../types";
import type { PolicyMatch } from "../../ca-baseline";

/**
 * CAU009 Baseline Check: Require MFA for Admin Portals
 *
 * This check validates that MFA is required specifically for admin portals.
 *
 * Required policy conditions:
 * - Apps: Microsoft Admin Portals (or All Cloud Apps)
 * - Grant control: Require multifactor authentication
 *
 * Note: This check passes if:
 * - A dedicated policy targets "Microsoft Admin Portals" with MFA, OR
 * - A broad "All Apps" policy already covers this (effective coverage)
 *
 * Why this matters:
 * - 80% of breaches involve compromised admin credentials (Microsoft Security Report 2024)
 * - Admin portals provide access to tenant configuration and user data
 * - MFA on admin portals is a Zero Trust baseline requirement
 */
export function createCAU009Check(helpers: CheckHelpers): BaselineCheck {
  return {
    // ===== METADATA =====
    id: "CAU009",
    name: "Require MFA for Admin Portals",
    description: "Protects privileged access to Azure, Intune, and Entra portals.",
    priority: 1,
    pillar: "Foundation",
    recommendation:
      "Ensure 'Microsoft Admin Portals' app is targeted by a dedicated MFA policy.",
    remediationEffort: "low",

    // ===== CONTEXT & GUIDANCE =====
    whyItMatters: `
Admin portals are the control plane for your Microsoft 365 tenant. Compromised admin
access leads to catastrophic outcomes:

Attack scenarios:
- Global Admin takeover → full tenant compromise
- User data exfiltration via admin portal access
- Privilege escalation (creating backdoor admin accounts)
- Configuration changes (disabling security controls)

Statistics:
- 80% of breaches involve compromised admin credentials
- Average time to detect admin compromise: 280 days (Ponemon Institute)
- Cost of privileged account breach: 7.5x higher than standard user

Microsoft Admin Portals includes:
- Azure Portal (portal.azure.com)
- Microsoft 365 Admin Center (admin.microsoft.com)
- Microsoft Entra Admin Center (entra.microsoft.com)
- Microsoft Intune Admin Console (intune.microsoft.com)
- Microsoft Defender portals
- Compliance and security portals

Defense-in-depth: Even if CAU002 (MFA for All Users) is enabled, having a dedicated
admin portal policy provides layered protection and clearer audit trails.
`,

    references: [
      "https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-policy-admin-mfa",
      "https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/security-planning",
      "https://learn.microsoft.com/en-us/security/privileged-access-workstations/privileged-access-access-model",
    ],

    implementationSteps: [
      "1. Create new CA policy: 'GRANT - Require MFA for Admin Portals'",
      "2. Conditions → Users: Include 'All users' (or specific admin roles)",
      "3. Conditions → Cloud apps: Select 'Microsoft Admin Portals'",
      "4. Access controls → Grant: Select 'Require multifactor authentication'",
      "5. Enable policy → Can enable immediately if CAU002 (MFA All Users) exists",
      "6. Verify admin users have MFA registered",
      "7. Test with non-production admin account first",
      "8. Switch to 'On'",
    ],

    graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - Require MFA for Admin Portals",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["MicrosoftAdminPortals"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["mfa"]
  }
}`,

    relatedChecks: ["CAU002", "CAU008", "CAU017"], // Related to general MFA, phishing-resistant MFA, and admin session controls

    // ===== DETECTION LOGIC =====
    evaluate(policies: Policy[]): PolicyMatch[] {
      const matches: PolicyMatch[] = [];

      for (const policy of policies) {
        // Skip disabled policies
        if (policy.state === "disabled") continue;

        // Check if policy meets requirements:
        // 1. Targets Microsoft Admin Portals OR All Apps (effective coverage)
        // 2. Requires MFA
        const targetsAdminPortals = helpers.targetsApp(policy, "MicrosoftAdminPortals");
        const targetsAllApps = helpers.targetsApp(policy, "All");
        const requiresMFA = helpers.requiresMFA(policy);

        if ((targetsAdminPortals || targetsAllApps) && requiresMFA) {
          // Policy matches this check
          const isFullMatch = policy.state === "enabled";
          const policyMatch = helpers.createPolicyMatch(policy, "CAU009", isFullMatch);

          matches.push(policyMatch);
        }
      }

      return matches;
    },
  };
}
