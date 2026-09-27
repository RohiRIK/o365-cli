/**
 * Type definitions for modular baseline check system
 */

import type { PolicyMatch } from "../ca-baseline";

/**
 * Pillar categories for baseline checks
 */
export type CheckPillar =
  | "Foundation"
  | "Risk-Based"
  | "Zero Trust"
  | "Administration"
  | "Guest/External";

/**
 * Priority levels (1 = highest, 3 = lowest)
 */
export type CheckPriority = 1 | 2 | 3;

/**
 * Remediation effort estimation
 */
export type RemediationEffort = "low" | "medium" | "high";

/**
 * Microsoft Graph policy object (simplified type)
 * See: https://learn.microsoft.com/en-us/graph/api/resources/conditionalaccesspolicy
 */
export interface Policy {
  id?: string;
  displayName?: string;
  state: "enabled" | "enabledReportOnly" | "disabled";
  conditions?: {
    users?: {
      includeUsers?: string[];
      excludeUsers?: string[];
      includeGroups?: string[];
      excludeGroups?: string[];
      includeRoles?: string[];
      excludeRoles?: string[];
      includeGuestsOrExternalUsers?: any;
    };
    applications?: {
      includeApplications?: string[];
      excludeApplications?: string[];
      includeUserActions?: string[];
    };
    clientAppTypes?: string[];
    platforms?: {
      includePlatforms?: string[];
      excludePlatforms?: string[];
    };
    signInRiskLevels?: string[];
    userRiskLevels?: string[];
    locations?: {
      includeLocations?: string[];
      excludeLocations?: string[];
    };
  };
  grantControls?: {
    operator?: "OR" | "AND";
    builtInControls?: string[];
    authenticationStrength?: any;
    customAuthenticationFactors?: string[];
  };
  sessionControls?: {
    signInFrequency?: any;
    persistentBrowser?: {
      mode?: "always" | "never";
    };
  };
}

/**
 * Individual baseline check module
 *
 * Each check is defined as a separate TypeScript module with co-located:
 * - Metadata (id, name, description, priority)
 * - Context (whyItMatters, references, implementation steps)
 * - Detection logic (evaluate function)
 *
 * Benefits:
 * - Type safety with full TypeScript support
 * - Co-location of logic and metadata
 * - Testable in isolation
 * - No JSON bloat
 * - IDE autocomplete and go-to-definition
 */
export interface BaselineCheck {
  // ===== METADATA =====

  /** Unique check identifier (e.g., "CAP001", "CAU002") */
  id: string;

  /** Short human-readable name */
  name: string;

  /** One-sentence description of what this check validates */
  description: string;

  /** Priority level: 1 (critical) to 3 (recommended) */
  priority: CheckPriority;

  /** Security pillar category */
  pillar: CheckPillar;

  // ===== CONTEXT & GUIDANCE =====

  /**
   * Why this check matters from a security perspective
   * Include attack vectors, breach statistics, and business impact
   */
  whyItMatters?: string;

  /**
   * Microsoft Learn documentation and security research references
   */
  references?: string[];

  /**
   * Step-by-step implementation guide
   * Use numbered list format for clarity
   */
  implementationSteps?: string[];

  /**
   * Example Graph API JSON payload for creating the policy
   */
  graphApiExample?: string;

  /**
   * Related check IDs (dependencies or complementary checks)
   */
  relatedChecks?: string[];

  /**
   * Quick recommendation text (legacy compatibility)
   */
  recommendation: string;

  /**
   * Estimated effort to remediate if failing
   */
  remediationEffort: RemediationEffort;

  // ===== DETECTION LOGIC =====

  /**
   * Evaluate policies against this baseline check
   *
   * @param policies Array of Conditional Access policies from Graph API
   * @returns Array of policies that satisfy (or partially satisfy) this check
   *          Empty array if check fails (no matching policies)
   *
   * Detection rules should:
   * - Use helper methods for common patterns (targetsApp, requiresMFA, meetsGrantControls)
   * - Handle policy state (enabled vs enabledReportOnly vs disabled)
   * - Return PolicyMatch objects with coverage details and gaps
   * - Set appropriate confidence levels
   */
  evaluate(policies: Policy[]): PolicyMatch[];
}

/**
 * Helper methods for check evaluation
 *
 * These methods are provided by the analyzer and can be imported
 * by individual check modules to avoid code duplication.
 */
export interface CheckHelpers {
  /**
   * Check if a policy effectively targets a specific app ID or set of apps
   *
   * @param policy The policy to check
   * @param appId App ID (e.g., "All", "Office365", "MicrosoftAdminPortals", GUID)
   * @returns true if policy targets this app (including via "All" apps)
   */
  targetsApp(policy: Policy, appId: string): boolean;

  /**
   * Check if a policy's grant controls meet requirements, respecting the operator (OR/AND)
   *
   * @param policy The policy to evaluate
   * @param requiredControls Array of control names that would satisfy the requirement
   * @param mode "ANY" means ANY of the requiredControls satisfies (OR logic),
   *             "ALL" means ALL requiredControls must be present (AND logic)
   * @returns true if the policy's grant controls meet the requirement
   */
  meetsGrantControls(policy: Policy, requiredControls: string[], mode?: "ANY" | "ALL"): boolean;

  /**
   * Check if a policy effectively requires MFA (handling operators and multiple controls)
   *
   * @param policy The policy to check
   * @returns true if policy requires MFA (via strength, custom factors, or mfa control)
   */
  requiresMFA(policy: Policy): boolean;

  /**
   * Create a PolicyMatch evidence object from a policy
   *
   * @param policy The policy that matches the check
   * @param checkId The baseline check ID
   * @param isFullMatch Whether this is a complete match or partial
   * @returns PolicyMatch object with coverage details
   */
  createPolicyMatch(policy: Policy, checkId: string, isFullMatch: boolean): PolicyMatch;

  /**
   * Determine user scope coverage
   */
  determineUserScope(policy: Policy): "full" | "partial" | "missing";

  /**
   * Determine app scope coverage
   */
  determineAppScope(policy: Policy): "full" | "partial" | "missing";
}
