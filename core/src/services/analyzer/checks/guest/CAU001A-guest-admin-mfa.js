/**
 * CAU001A: Require MFA for Guest Admin Access
 *
 * Guest/External pillar - Priority 2 (Important)
 *
 * Hardens admin interfaces accessed by external vendors and contractors.
 * Specifically targets Azure AD portal access (Windows Azure Active Directory app)
 * which is used for identity management.
 */
export function createCAU001ACheck(helpers) {
    return {
        id: "CAU001A",
        name: "Require MFA for Guest Admin Access",
        description: "Hardens admin interfaces accessed by external vendors.",
        priority: 2,
        pillar: "Guest/External",
        recommendation: "Require MFA for guests accessing 'Windows Azure Active Directory'.",
        remediationEffort: "low",
        whyItMatters: `
Guest admin access scenarios:
- MSP (Managed Service Provider) administering your tenant
- External consultants with delegated admin rights
- Partner co-admin arrangements (M&A, joint ventures)

Windows Azure Active Directory app ID (00000002-0000-0000-c000-000000000000) includes:
- Azure AD portal access
- User/group management via portal
- Role assignments
- Some Graph API operations

Threat model:
- External admin credentials more likely to be shared across clients
- Lower visibility into vendor's security practices
- Vendor breach cascades to all clients

Defense-in-depth: Even if CAU001 (MFA for All Guests) is enabled, this provides
layered protection specifically for identity management operations.

Note: Consider avoiding guest admin accounts entirely - use Azure Lighthouse or
Privileged Identity Management (PIM) for vendor access instead.
`,
        references: [
            "https://learn.microsoft.com/en-us/entra/external-id/b2b-tutorial-require-mfa",
            "https://learn.microsoft.com/en-us/azure/lighthouse/how-to/view-manage-service-providers",
        ],
        implementationSteps: [
            "1. Review: Do you really need guest admin accounts? (Consider alternatives)",
            "2. If yes, create new CA policy: 'GRANT - MFA for Guest Admin Access'",
            "3. Conditions → Users: Select 'All guest and external users'",
            "4. Conditions → Cloud apps: '00000002-0000-0000-c000-000000000000' (Azure AD app)",
            "5. Access controls → Grant: 'Require multifactor authentication'",
            "6. Communicate to vendors: MFA required for admin portal access",
            "7. Enable policy",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - MFA for Guest Admin Access",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeGuestsOrExternalUsers": {
        "guestOrExternalUserTypes": "b2bCollaborationGuest,b2bCollaborationMember",
        "externalTenants": {
          "membershipKind": "all"
        }
      }
    },
    "applications": {
      "includeApplications": ["00000002-0000-0000-c000-000000000000"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["mfa"]
  }
}`,
        relatedChecks: ["CAU001", "CAU009"],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Windows Azure Active Directory app GUID
                const azureAdAppId = "00000002-0000-0000-c000-000000000000";
                // Check if policy targets Azure AD app and requires MFA
                const targetsAzureAD = helpers.targetsApp(policy, azureAdAppId);
                const requiresMFA = helpers.requiresMFA(policy);
                if (targetsAzureAD && requiresMFA) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAU001A", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
