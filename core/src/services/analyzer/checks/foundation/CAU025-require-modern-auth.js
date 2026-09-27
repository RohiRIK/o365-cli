/**
 * CAU025: Require Modern Authentication Clients
 *
 * Foundation pillar - Priority 2 (Important)
 *
 * Blocks access from clients that don't support modern authentication
 * (OAuth 2.0, SAML). Legacy clients using basic authentication are
 * vulnerable to credential theft and bypass modern security controls.
 */
export function createCAU025Check(helpers) {
    return {
        id: "CAU025",
        name: "Require Modern Authentication Clients",
        description: "Blocks legacy clients that don't support OAuth 2.0 or modern authentication protocols.",
        priority: 2,
        pillar: "Foundation",
        recommendation: "Create a policy allowing only modern authentication clients (mobile apps, browsers).",
        remediationEffort: "medium",
        whyItMatters: `
Modern authentication vs legacy authentication:
- Modern: OAuth 2.0, SAML, OpenID Connect (supports MFA, CA policies)
- Legacy: Basic Auth, NTLM, Kerberos (credentials sent in cleartext)

Legacy client examples:
- Older Outlook versions (2013 and earlier)
- Third-party email clients (Thunderbird, Apple Mail with basic auth)
- ActiveSync clients without modern auth support
- IMAP/POP3/SMTP connections

Why block legacy clients:
- Can't enforce MFA (credentials only, no second factor)
- Bypass Conditional Access policies entirely
- Vulnerable to credential interception (no token-based auth)
- No support for risk-based access controls

Overlap with CAP001 (Block Legacy Auth):
- CAP001: Blocks legacy protocols (POP, IMAP, SMTP, ActiveSync)
- CAU025: Blocks legacy clients (apps that don't support modern auth)
- Both work together for comprehensive coverage

Migration strategy:
- Identify legacy clients via sign-in logs
- Upgrade to modern versions (Outlook 2016+, Exchange Online)
- Enable modern auth on email servers
- Communicate upgrade timeline to users
`,
        references: [
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-conditions#client-apps",
            "https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/enable-or-disable-modern-authentication-in-exchange-online",
        ],
        implementationSteps: [
            "1. Audit sign-in logs: Identify clients using legacy authentication",
            "2. Communicate upgrade requirements to users",
            "3. Enable modern auth on Exchange Online (if not already enabled)",
            "4. Create new CA policy: 'BLOCK - Legacy Authentication Clients'",
            "5. Conditions → Client apps: Block 'Exchange ActiveSync clients' and 'Other clients'",
            "6. Access controls → Block access",
            "7. Enable in Report-Only mode for 30 days",
            "8. Review blocked clients and support upgrade process",
            "9. Switch to 'On'",
        ],
        graphApiExample: `
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "BLOCK - Legacy Authentication Clients",
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["<break-glass-account-id>"]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "clientAppTypes": [
      "exchangeActiveSync",  // Legacy ActiveSync
      "other"                // IMAP, POP3, SMTP, legacy apps
    ]
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"]
  }
}

Note: This is very similar to CAP001. The difference is CAP001 focuses on
protocol-level blocking, while CAU025 focuses on client app filtering.
Many organizations combine these into a single policy.`,
        relatedChecks: ["CAP001"],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Check if policy blocks legacy client app types
                const clientAppTypes = policy.conditions?.clientAppTypes || [];
                const blocksLegacyClients = (clientAppTypes.includes("exchangeActiveSync") ||
                    clientAppTypes.includes("other")) &&
                    helpers.meetsGrantControls(policy, ["block"]);
                if (blocksLegacyClients) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAU025", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
