/**
 * CAU023: Block Admin Access from Unmanaged Devices
 *
 * Administration pillar - Priority 1 (Critical)
 *
 * Administrators should ONLY access privileged portals from managed,
 * compliant devices (ideally Privileged Access Workstations). Blocking
 * admin access from personal/unmanaged devices prevents compromise.
 */
export function createCAU023Check(helpers) {
    return {
        id: "CAU023",
        name: "Block Admin Access from Unmanaged Devices",
        description: "Prevents administrators from accessing portals on personal or unmanaged devices.",
        priority: 1,
        pillar: "Administration",
        recommendation: "Create a policy blocking admin portal access unless device is compliant or domain-joined.",
        remediationEffort: "medium",
        whyItMatters: `
Admin access from unmanaged devices is high-risk:
- Personal laptops lack EDR, encryption, patch management
- Home networks more vulnerable than corporate networks
- Shared/family computers may have malware
- Lost/stolen personal devices expose admin credentials

Attack scenarios:
- Admin uses personal MacBook at coffee shop → WiFi sniffing
- Admin's home PC infected with keylogger → Credentials stolen
- Admin's tablet lacks encryption → Device theft = tenant compromise

Privileged Access Workstation (PAW) model:
- Dedicated, locked-down workstations for admin tasks
- No email, web browsing, or productivity apps (attack surface reduction)
- Full disk encryption, EDR, application whitelisting
- Network isolation, jump box access

Microsoft recommendation: Zero Trust admin access model
- Tier 0 (Global Admin): PAW only, no exceptions
- Tier 1 (Role Admins): Compliant corporate devices
- Tier 2 (Helpdesk): Hybrid joined devices minimum

Requires: Microsoft Intune or Hybrid Azure AD Join
`,
        references: [
            "https://learn.microsoft.com/en-us/security/privileged-access-workstations/privileged-access-deployment",
            "https://learn.microsoft.com/en-us/security/privileged-access-workstations/privileged-access-access-model",
        ],
        implementationSteps: [
            "1. Deploy Privileged Access Workstations (PAWs) for Global Admins",
            "2. Ensure all admin devices enrolled in Intune and compliant",
            "3. Create new CA policy: 'BLOCK - Admin Access from Unmanaged Devices'",
            "4. Conditions → Users: Include all directory roles",
            "5. Conditions → Cloud apps: 'Microsoft Admin Portals' + 'All cloud apps'",
            "6. Access controls → Grant access → Require device compliance OR Hybrid Azure AD joined",
            "7. IMPORTANT: Test with non-production admin account first",
            "8. Communicate to admins: Admin access restricted to corporate devices",
            "9. Enable policy (no Report-Only mode for admins)",
            "10. Monitor failed sign-ins from unmanaged devices",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "BLOCK - Admin Access from Unmanaged Devices",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeRoles": [
        "62e90394-69f5-4237-9190-012177145e10",  // Global Administrator
        "194ae4cb-b126-40b2-bd5b-6091b380977d",  // Security Administrator
        "9b895d92-2cd3-44c7-9d02-a6ac2d5ea5c3"   // Application Administrator
      ],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["compliantDevice", "domainJoinedDevice"]
  }
}`,
        relatedChecks: ["CAU009", "CAU017", "CAU018"],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Check if policy targets admin roles and requires device compliance
                const hasAdminRoles = policy.conditions?.users?.includeRoles &&
                    policy.conditions.users.includeRoles.length > 0;
                const requiresCompliance = helpers.meetsGrantControls(policy, ["compliantDevice", "domainJoinedDevice"], "ANY");
                if (hasAdminRoles && requiresCompliance) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAU023", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
