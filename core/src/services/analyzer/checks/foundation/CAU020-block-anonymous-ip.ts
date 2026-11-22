/**
 * CAU020: Block Anonymous/Tor IP Addresses
 *
 * Foundation pillar - Priority 1 (Critical)
 *
 * Anonymous IP addresses (Tor, VPN exit nodes, anonymous proxies) are used
 * by attackers to hide their identity. Blocking these reduces the attack
 * surface for credential stuffing and data exfiltration.
 */

import type { BaselineCheck, Policy, CheckHelpers } from "../types";
import type { PolicyMatch } from "../../ca-baseline";

export function createCAU020Check(helpers: CheckHelpers): BaselineCheck {
  return {
    id: "CAU020",
    name: "Block Anonymous/Tor IP Addresses",
    description: "Prevents attacks originating from anonymizing networks and VPN exit nodes.",
    priority: 1,
    pillar: "Foundation",
    recommendation:
      "Create a policy blocking access from anonymous IP addresses and Tor exit nodes.",
    remediationEffort: "low",

    whyItMatters: `
Anonymous IP addresses are used to evade detection:
- Tor exit nodes (The Onion Router network)
- Anonymous VPN services (NordVPN, ProtonVPN exit nodes)
- Anonymous proxy services (public SOCKS proxies)
- Data center IP ranges (non-residential IPs)

Why attackers use anonymous IPs:
- Hide geographic location
- Evade IP-based blocking
- Mask true origin after data breach
- Avoid attribution during exfiltration

Legitimate use cases are rare in corporate environments - most users connect
from home/office ISPs or trusted corporate VPNs.

Requires: Azure AD Premium P1 (Named Locations feature)
`,

    references: [
      "https://learn.microsoft.com/en-us/entra/identity/conditional-access/location-condition",
      "https://learn.microsoft.com/en-us/entra/id-protection/concept-identity-protection-risks#anonymous-ip-address",
    ],

    implementationSteps: [
      "1. Identify legitimate VPN exit IPs (corporate VPN concentrators)",
      "2. Create Named Location: 'Trusted Corporate VPNs' with these IPs",
      "3. Create new CA policy: 'BLOCK - Anonymous IP Addresses'",
      "4. Conditions → Locations: Include 'All locations', Exclude 'Trusted Corporate VPNs' + MFA trusted IPs",
      "5. Conditions → Use 'Anonymous IP address' risk detection (if P2 licensed)",
      "6. OR use third-party IP reputation service integrated via API",
      "7. Access controls → Block access",
      "8. Enable in Report-Only mode for 2 weeks",
      "9. Review for false positives (traveling users, remote workers)",
      "10. Switch to 'On'",
    ],

    graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "BLOCK - Anonymous IP Addresses",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "locations": {
      "includeLocations": ["All"],
      "excludeLocations": ["AllTrusted", "<corporate-vpn-location-id>"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"]
  }
}

Note: For anonymous IP detection, use Sign-in Risk condition instead:
"conditions": {
  "signInRiskLevels": ["medium", "high"]  // Includes anonymous IP detection
}`,

    relatedChecks: ["CAU015", "CAU021"],

    evaluate(policies: Policy[]): PolicyMatch[] {
      const matches: PolicyMatch[] = [];

      for (const policy of policies) {
        if (policy.state === "disabled") continue;

        // Look for location-based blocking policies
        const hasLocationBlock =
          policy.conditions?.locations?.includeLocations?.includes("All") &&
          policy.conditions?.locations?.excludeLocations &&
          policy.conditions.locations.excludeLocations.length > 0;

        const blocksAccess = helpers.meetsGrantControls(policy, ["block"]);

        // OR policies using sign-in risk detection (which includes anonymous IP)
        const hasRiskDetection =
          policy.conditions?.signInRiskLevels &&
          policy.conditions.signInRiskLevels.length > 0;

        if ((hasLocationBlock || hasRiskDetection) && blocksAccess) {
          const isFullMatch = policy.state === "enabled";
          const policyMatch = helpers.createPolicyMatch(policy, "CAU020", isFullMatch);
          matches.push(policyMatch);
        }
      }

      return matches;
    },
  };
}
