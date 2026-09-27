/**
 * CAU024: Require MFA for Password Reset
 *
 * Foundation pillar - Priority 1 (Critical)
 *
 * Self-service password reset (SSPR) is a high-value target. Attackers
 * who compromise the SSPR process can reset passwords and take over accounts.
 * Requiring MFA for SSPR prevents this attack vector.
 */

import type { BaselineCheck, Policy, CheckHelpers } from "../types";
import type { PolicyMatch } from "../../ca-baseline";

export function createCAU024Check(helpers: CheckHelpers): BaselineCheck {
  return {
    id: "CAU024",
    name: "Require MFA for Password Reset",
    description: "Prevents attackers from abusing self-service password reset to take over accounts.",
    priority: 1,
    pillar: "Foundation",
    recommendation:
      "Configure SSPR to require multiple methods (MFA equivalent) for password reset.",
    remediationEffort: "low",

    whyItMatters: `
Password reset attack scenarios:
- Attacker knows user's email address → SSPR initiated
- SSPR only requires security questions → Easy to guess/phish
- Password reset successful → Account takeover complete

Weak SSPR configurations:
- Single method required (email only, phone only)
- Security questions (mother's maiden name, pet name)
- No MFA verification during reset process
- SMS-only verification (SIM swapping vulnerability)

Secure SSPR configuration:
- Require TWO methods minimum (defense-in-depth)
- Acceptable methods: Authenticator app, email, phone (not SMS alone)
- Best practice: Authenticator app + email
- Block security questions entirely (guessable)

Why this matters:
- SSPR bypasses normal authentication flow
- Attackers specifically target SSPR as easier entry point
- Password reset = permanent account takeover (vs session hijacking)

Note: This check validates SSPR configuration, not a CA policy.
SSPR settings are configured in Entra → Password reset.
`,

    references: [
      "https://learn.microsoft.com/en-us/entra/identity/authentication/concept-sspr-howitworks",
      "https://learn.microsoft.com/en-us/entra/identity/authentication/howto-sspr-deployment",
    ],

    implementationSteps: [
      "1. Navigate to: Entra → Password reset → Authentication methods",
      "2. Set 'Number of methods required to reset' to 2 (not 1)",
      "3. Enable methods: Authenticator app, Email, Mobile phone",
      "4. Disable: Security questions (too weak)",
      "5. Enable: 'Require users to register when signing in'",
      "6. Configure: Registration campaign to ensure all users have 2+ methods",
      "7. Test: Initiate SSPR, verify 2 methods required",
      "8. Monitor: Review SSPR audit logs for suspicious resets",
    ],

    graphApiExample: `
# SSPR is configured via tenant settings, not CA policies
# Use Graph API to verify SSPR configuration:

GET https://graph.microsoft.com/beta/policies/authenticationMethodsPolicy

# Expected response:
{
  "passwordResetSettings": {
    "enabledForReportingButNotEnforced": false,
    "enabledForScope": "all",
    "numberOfMethodsRequired": 2,  // MUST be 2 or higher
    "emailSettings": { "isEnabled": true },
    "mobilePhoneSettings": { "isEnabled": true },
    "microsoftAuthenticatorSettings": { "isEnabled": true }
  }
}

# Note: No CA policy needed - this is tenant-level configuration
# However, CAU012 (MFA for Security Info Registration) complements this check
`,

    relatedChecks: ["CAU012"],

    evaluate(policies: Policy[]): PolicyMatch[] {
      // SSPR configuration is not enforced via CA policies
      // This check would ideally query the authentication methods policy API
      // For now, we return empty (check must be validated via tenant config)

      // Related: CAU012 protects the registration process with MFA
      return [];
    },
  };
}
