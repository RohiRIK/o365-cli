/**
 * CAU022: Terms of Use Acceptance
 *
 * Administration pillar - Priority 2 (Important)
 *
 * Requires users to accept Terms of Use, Acceptable Use Policy, or
 * privacy statements before accessing corporate resources. Critical
 * for compliance (GDPR, HIPAA, SOC2) and legal liability protection.
 */
export function createCAU022Check(helpers) {
    return {
        id: "CAU022",
        name: "Terms of Use Acceptance",
        description: "Requires users to accept AUP/ToU before accessing corporate resources.",
        priority: 2,
        pillar: "Administration",
        recommendation: "Create Terms of Use in Entra and enforce via Conditional Access policy.",
        remediationEffort: "low",
        whyItMatters: `
Legal and compliance requirements:
- GDPR: Data processing consent and privacy notice acceptance
- HIPAA: Business Associate Agreement acknowledgment
- SOC2: Acceptable Use Policy (AUP) acceptance
- ISO 27001: Security policy acknowledgment
- Cybersecurity insurance: Proof of security awareness

Terms of Use scenarios:
- Acceptable Use Policy (no personal use, no illegal activity)
- Data handling guidelines (encryption, sharing restrictions)
- BYOD agreement (corporate data on personal devices)
- Remote work policy (security requirements for home office)
- Third-party access agreement (vendor/contractor terms)

Audit trail benefits:
- Timestamp of acceptance (compliance evidence)
- Version control (track policy changes over time)
- User-specific acceptance records
- Revocable consent (re-prompt on policy updates)

Requires: Azure AD Premium P1 or higher
`,
        references: [
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/terms-of-use",
            "https://learn.microsoft.com/en-us/entra/identity/conditional-access/require-tou",
        ],
        implementationSteps: [
            "1. Draft Terms of Use document (work with Legal/Compliance team)",
            "2. Create Terms of Use in Entra (Identity → Governance → Terms of use)",
            "3. Upload PDF document, configure settings (expiration, re-acceptance frequency)",
            "4. Create new CA policy: 'GRANT - Terms of Use Acceptance'",
            "5. Conditions → Users: Include 'All users'",
            "6. Conditions → Cloud apps: 'All cloud apps' (or specific sensitive apps)",
            "7. Access controls → Grant access → Require terms of use",
            "8. Enable policy",
            "9. Verify: Users prompted to accept ToU on next sign-in",
            "10. Monitor: Review acceptance logs (Entra → Governance → Terms of use → Audit logs)",
        ],
        graphApiExample: `
# Step 1: Create Terms of Use
POST https://graph.microsoft.com/v1.0/agreements
{
  "displayName": "Corporate Acceptable Use Policy 2024",
  "isViewingBeforeAcceptanceRequired": true,
  "files": [
    {
      "fileName": "AUP-2024.pdf",
      "language": "en",
      "isDefault": true,
      "fileData": {
        "data": "<base64-encoded-pdf>"
      }
    }
  ],
  "termsExpiration": {
    "frequency": "P90D",  // Re-acceptance every 90 days
    "startDateTime": "2024-01-01T00:00:00Z"
  }
}

# Step 2: Create CA policy
POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
{
  "displayName": "GRANT - Terms of Use Acceptance",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeUsers": ["All"]
    },
    "applications": {
      "includeApplications": ["All"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "termsOfUse": ["<terms-of-use-agreement-id>"]
  }
}`,
        relatedChecks: [],
        evaluate(policies) {
            const matches = [];
            for (const policy of policies) {
                if (policy.state === "disabled")
                    continue;
                // Check if policy requires terms of use acceptance
                // Note: termsOfUse is not in our Policy type yet, but checking grant controls
                const hasTermsOfUse = policy.grantControls?.termsOfUse &&
                    policy.grantControls.termsOfUse.length > 0;
                if (hasTermsOfUse) {
                    const isFullMatch = policy.state === "enabled";
                    const policyMatch = helpers.createPolicyMatch(policy, "CAU022", isFullMatch);
                    matches.push(policyMatch);
                }
            }
            return matches;
        },
    };
}
