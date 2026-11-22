/**
 * CAD005: Token Protection for Desktop Apps
 *
 * Zero Trust pillar - Priority 3 (Recommended)
 *
 * Token protection binds authentication tokens to the device, preventing
 * token theft and replay attacks. If tokens are stolen from memory or disk,
 * they cannot be used on a different device.
 */
export function createCAD005Check(helpers) {
    return {
        id: "CAD005",
        name: "Token Protection for Desktop Apps",
        description: "Binds authentication tokens to device, preventing theft and replay attacks.",
        priority: 3,
        pillar: "Zero Trust",
        recommendation: "Enable token protection for Windows devices accessing Office desktop apps.",
        remediationEffort: "medium",
        whyItMatters: `
Token theft attack vectors:
- Malware extracting tokens from browser memory/cookies
- Pass-the-cookie attacks (Mimikatz, token stealing tools)
- Cross-device token replay (stolen token used on attacker device)
- Session hijacking via process memory dumps

Token protection mechanisms:
- Hardware-bound tokens (TPM chip signing)
- Device fingerprinting (CPU ID, MAC address binding)
- Proof-of-possession tokens (cryptographic binding)
- Windows Hello for Business integration

Supported apps (as of 2024):
- Microsoft 365 Desktop Apps (Word, Excel, PowerPoint, Outlook)
- Microsoft Teams Desktop
- OneDrive sync client
- Microsoft Edge browser

Requires:
- Windows 10/11 (1903+) with TPM 2.0
- Azure AD joined or Hybrid Azure AD joined devices
- Microsoft 365 Apps for Enterprise
`,
        references: [
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-token-protection",
            "https://techcommunity.microsoft.com/t5/microsoft-entra-blog/token-protection-in-microsoft-entra/ba-p/2365673",
        ],
        implementationSteps: [
            "1. Verify device requirements: Windows 10/11 with TPM 2.0",
            "2. Ensure devices are Azure AD joined or Hybrid Azure AD joined",
            "3. Deploy Microsoft 365 Apps for Enterprise (Version 2209+)",
            "4. Create new CA policy: 'SESSION - Token Protection for Desktop Apps'",
            "5. Conditions → Platforms: Windows",
            "6. Conditions → Client apps: Modern authentication clients",
            "7. Session controls → Sign-in frequency + Require token protection",
            "8. Enable in Report-Only mode for 2 weeks",
            "9. Monitor compatibility with older devices/apps",
            "10. Switch to 'On'",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "SESSION - Token Protection for Desktop Apps",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"]
    },
    "applications": {
      "includeApplications": ["Office365"]
    },
    "platforms": {
      "includePlatforms": ["windows"]
    },
    "clientAppTypes": ["mobileAppsAndDesktopClients"]
  },
  "sessionControls": {
    "signInFrequency": {
      "value": 24,
      "type": "hours"
    },
    "disableResilienceDefaults": false
  }
}

Note: Token protection is configured via registry on Windows devices:
HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\\Zones\\3\\1A10
Value: 0 (Enable token protection)`,
        relatedChecks: ["CAD001", "CAD003"],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Check for Windows platform targeting with session controls
                const targetsWindows = policy.conditions?.platforms?.includePlatforms?.includes("windows");
                const hasSessionControls = policy.sessionControls?.signInFrequency !== null;
                if (targetsWindows && hasSessionControls) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAD005", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
