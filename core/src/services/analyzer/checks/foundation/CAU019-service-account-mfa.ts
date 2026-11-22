/**
 * CAU019: Require MFA for Service/Workload Identities
 *
 * Foundation pillar - Priority 1 (Critical)
 *
 * Service accounts and workload identities often have elevated permissions
 * and should require MFA or certificate-based authentication. Compromised
 * service accounts are a common attack vector for lateral movement.
 */

import type { BaselineCheck, Policy, CheckHelpers } from "../types";
import type { PolicyMatch } from "../../ca-baseline";

export function createCAU019Check(helpers: CheckHelpers): BaselineCheck {
  return {
    id: "CAU019",
    name: "Require MFA for Service/Workload Identities",
    description: "Protects automated accounts with elevated permissions from compromise.",
    priority: 1,
    pillar: "Foundation",
    recommendation: "Create a policy requiring MFA or certificate auth for service principals.",
    remediationEffort: "medium",

    whyItMatters: `
Service accounts and workload identities are high-value targets:
- Often have elevated permissions (app registrations, API access)
- Credentials stored in code, config files, or key vaults
- Compromise enables API abuse and data exfiltration
- Frequently exempted from security policies (mistake!)

Attack scenarios:
- Hardcoded credentials leaked in GitHub repositories
- Service principal secrets exposed in CI/CD pipelines
- Compromised automation accounts used for ransomware deployment

Microsoft recommendation: Use managed identities when possible, require MFA
for service principals that authenticate as users.
`,

    references: [
      "https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview",
      "https://learn.microsoft.com/en-us/entra/identity-platform/howto-create-service-principal-portal",
    ],

    implementationSteps: [
      "1. Audit service accounts: Identify all accounts used for automation",
      "2. Migrate to Managed Identities where possible (no credentials needed)",
      "3. For remaining service principals, implement certificate-based auth",
      "4. Create new CA policy: 'GRANT - MFA for Service Principals'",
      "5. Conditions → Users: Include service account group",
      "6. Access controls → Require authentication strength (certificate-based)",
      "7. Enable policy",
    ],

    graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - MFA for Service Principals",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeGroups": ["<service-accounts-group-id>"]
    },
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "authenticationStrength": {
      "id": "00000000-0000-0000-0000-000000000003"  // Certificate-based MFA
    }
  }
}`,

    relatedChecks: ["CAU002"],

    evaluate(policies: Policy[]): PolicyMatch[] {
      const matches: PolicyMatch[] = [];

      for (const policy of policies) {
        if (policy.state === "disabled") continue;

        // Look for policies targeting service account groups with strong auth
        const targetsServiceAccounts =
          policy.conditions?.users?.includeGroups &&
          policy.conditions.users.includeGroups.length > 0;

        const hasStrongAuth =
          policy.grantControls?.authenticationStrength !== null ||
          helpers.requiresMFA(policy);

        if (targetsServiceAccounts && hasStrongAuth) {
          const isFullMatch = policy.state === "enabled";
          const policyMatch = helpers.createPolicyMatch(policy, "CAU019", isFullMatch);
          matches.push(policyMatch);
        }
      }

      return matches;
    },
  };
}
