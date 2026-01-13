/**
 * CAP001: Block Legacy Authentication
 *
 * Foundation pillar - Priority 1 (Critical)
 *
 * Legacy authentication protocols (POP, IMAP, SMTP, Basic Auth) were designed before
 * modern security controls existed. They bypass MFA entirely and are the primary vector
 * for password spray attacks.
 */

import type { BaselineCheck, Policy, CheckHelpers } from "../types";
import type { PolicyMatch } from "../../ca-baseline";

/**
 * CAP001 Baseline Check: Block Legacy Authentication
 *
 * This check validates that your tenant blocks legacy authentication protocols that
 * bypass modern authentication flows (and therefore bypass MFA).
 *
 * Required policy conditions:
 * - Targets: All users and All cloud apps
 * - Client app types: Exchange ActiveSync, Other clients
 * - Grant control: Block access
 *
 * Why this matters:
 * - 99% of password spray attacks use legacy protocols
 * - Legacy auth bypasses MFA, Conditional Access, and Identity Protection
 * - Microsoft Security Intelligence reports 300%+ increase in legacy auth attacks in 2024
 */
export function createCAP001Check(helpers: CheckHelpers): BaselineCheck {
  return {
    // ===== METADATA =====
    id: "CAP001",
    name: "Block Legacy Authentication",
    description:
      "Legacy protocols (POP, IMAP, SMTP) bypass MFA and are used in 99% of password spray attacks.",
    priority: 1,
    pillar: "Foundation",
    recommendation:
      "Create a policy blocking 'Exchange ActiveSync' and 'Other clients' for all users.",
    remediationEffort: "medium", // Creating new policy + testing legacy auth dependencies

    // ===== CONTEXT & GUIDANCE =====
    whyItMatters: `
Legacy authentication protocols were designed before modern security controls existed.
They bypass MFA entirely, allowing attackers to:
- Password spray without triggering MFA prompts
- Use stolen credentials from dark web dumps
- Compromise accounts in seconds

Microsoft Security Intelligence reports 300%+ increase in legacy auth attacks in 2024.
99% of successful password spray attacks use legacy protocols.

Common legacy protocols:
- POP3 / IMAP4 (email clients)
- SMTP AUTH (email sending)
- Exchange ActiveSync (older mobile clients)
- Basic Authentication (API calls)
`,

    references: [
      "https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-policy-block-legacy-auth",
      "https://learn.microsoft.com/en-us/entra/identity/conditional-access/block-legacy-authentication",
      "https://techcommunity.microsoft.com/t5/microsoft-entra-blog/block-legacy-authentication-in-your-organization/ba-p/3112486",
    ],

    implementationSteps: [
      "1. Create new CA policy: 'BLOCK - Legacy Authentication'",
      "2. Conditions → Users: Include 'All users', Exclude 'Break-glass accounts'",
      "3. Conditions → Cloud apps: 'All cloud apps'",
      "4. Conditions → Client apps: Select 'Exchange ActiveSync clients' and 'Other clients'",
      "5. Access controls → Grant: 'Block access'",
      "6. Enable policy → Start with 'Report-only mode' for 30 days",
      "7. Review sign-in logs for legitimate legacy auth usage (use Azure AD Sign-ins workbook)",
      "8. Communicate to users about upgrading to modern email clients",
      "9. Switch to 'On' after validation period",
    ],

    graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "BLOCK - Legacy Authentication",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "clientAppTypes": ["exchangeActiveSync", "other"]
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"]
  }
}`,

    relatedChecks: ["CAU002"], // Depends on MFA baseline being in place

    // ===== DETECTION LOGIC =====
    evaluate(policies: Policy[]): PolicyMatch[] {
      const matches: PolicyMatch[] = [];

      for (const policy of policies) {
        // Skip disabled policies
        if (policy.state === "disabled") continue;

        // Check if policy meets requirements:
        // 1. Targets all apps
        // 2. Includes legacy client app types (exchangeActiveSync, other)
        // 3. Blocks access
        const targetsAllApps = helpers.targetsApp(policy, "All");
        const clientAppTypes = policy.conditions?.clientAppTypes || [];
        const hasLegacyClients = clientAppTypes.some((t) =>
          ["exchangeActiveSync", "other"].includes(t)
        );
        const blocksAccess = helpers.meetsGrantControls(policy, ["block"]);

        if (targetsAllApps && hasLegacyClients && blocksAccess) {
          // Policy matches this check
          const isFullMatch = policy.state === "enabled";
          const policyMatch = helpers.createPolicyMatch(policy, "CAP001", isFullMatch);

          matches.push(policyMatch);
        }
      }

      return matches;
    },
  };
}
