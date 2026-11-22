/**
 * CAD001: Require Compliant/Hybrid Devices for O365
 *
 * Zero Trust pillar - Priority 3 (Recommended)
 *
 * Enforces device-level security controls (encryption, patching, antivirus)
 * before allowing access to corporate data. Requires Microsoft Intune or
 * hybrid Azure AD join.
 */
export function createCAD001Check(helpers) {
    return {
        id: "CAD001",
        name: "Require Compliant/Hybrid Devices for O365",
        description: "Enforces encryption and patching before accessing corporate data.",
        priority: 3,
        pillar: "Zero Trust",
        recommendation: "Require 'Compliant Device' or 'Hybrid Joined' for Office 365 apps.",
        remediationEffort: "high",
        whyItMatters: `
Device compliance ensures:
- BitLocker encryption enabled (prevents data theft from stolen devices)
- OS patches applied within SLA (prevents exploitation of known CVEs)
- Antivirus/EDR active and up-to-date
- Jailbreak/root detection (mobile devices)

Without device compliance:
- Unmanaged BYOD devices can access corporate SharePoint/OneDrive
- Lost/stolen laptops expose unencrypted corporate data
- Outdated devices vulnerable to ransomware

Requires: Microsoft Intune licensing (included in M365 E3/E5, EMS E3/E5)
`,
        references: [
            "https://learn.microsoft.com/en-us/mem/intune/protect/device-compliance-get-started",
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-policy-compliant-device",
        ],
        implementationSteps: [
            "1. Deploy Microsoft Intune and enroll corporate devices",
            "2. Create device compliance policies (Windows, iOS, Android)",
            "3. Configure compliance requirements (encryption, password, patch level)",
            "4. Create new CA policy: 'GRANT - Compliant Devices for Office 365'",
            "5. Conditions → Cloud apps: Select 'Office 365'",
            "6. Access controls → Grant access → Require device to be marked as compliant OR Require Hybrid Azure AD joined device",
            "7. Enable in Report-Only mode for 4 weeks (monitor BYOD impact)",
            "8. Communicate BYOD enrollment requirements",
            "9. Switch to 'On'",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - Compliant Devices for Office 365",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["Office365"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["compliantDevice", "domainJoinedDevice"]
  }
}`,
        relatedChecks: ["CAD002"],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Check if policy targets Office 365 or All Apps
                const targetsOffice365 = helpers.targetsApp(policy, "Office365");
                const targetsAllApps = helpers.targetsApp(policy, "All");
                // Accepts EITHER compliantDevice OR domainJoinedDevice (ANY mode)
                const requiresCompliance = helpers.meetsGrantControls(policy, ["compliantDevice", "domainJoinedDevice"], "ANY");
                if ((targetsOffice365 || targetsAllApps) && requiresCompliance) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAD001", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
