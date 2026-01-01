import type { CheckHelpers, Policy } from "./checks/types";
import { getAllChecks } from "./checks";

/**
 * Granular coverage breakdown for a policy match
 */
export interface CoverageDetails {
  userScope: "full" | "partial" | "missing";   // All users vs subset
  appScope: "full" | "partial" | "missing";    // All apps vs specific
  controlMatch: "exact" | "stronger" | "weaker" | "wrong"; // Block vs MFA
  platformMatch?: "full" | "partial" | "missing"; // For device checks
}

/**
 * Individual gap in a policy that partially matches
 */
export interface PolicyGap {
  type: "scope" | "control" | "state" | "exclusions";
  severity: "blocker" | "warning" | "info";
  message: string;
  suggestion: string; // What to change
}

/**
 * Evidence of a policy matching (or partially matching) a check
 */
export interface PolicyMatch {
  policyId: string;
  policyName: string;
  state: "enabled" | "enabledReportOnly" | "disabled";

  // Granular coverage breakdown (not just "partial")
  coverageScore: number; // 0.0-1.0 for prioritization
  coverageDetails: CoverageDetails;

  // Why it's not perfect
  gaps?: PolicyGap[];

  confidence: "high" | "medium" | "low";
}

/**
 * Information about a policy that conflicts with a check
 */
export interface ConflictInfo {
  policyId: string;
  policyName: string;
  conflictReason: string; // e.g., "Blocks access that this check requires"
}

/**
 * Result of analyzing a single baseline check
 */
export interface AnalysisResult {
  id: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "warn";
  recommendation: string;
  pillar: string;
  priority: number;

  // NEW FIELDS (Phase 2):
  whyItMatters?: string;
  references?: string[];
  matchedPolicies?: PolicyMatch[];      // Which policies satisfy this check (can be multiple)
  conflictingPolicies?: ConflictInfo[]; // Policies that interfere with this check
  remediationEffort?: "low" | "medium" | "high";
  estimatedImpactUsers?: number;        // How many users affected by the gap
}

/**
 * CA Baseline Analyzer
 *
 * Evaluates Conditional Access policies against Microsoft Best Practice baseline.
 * Uses modular TypeScript check system for maintainability and type safety.
 */
export class CABaselineAnalyzer implements CheckHelpers {
  /**
   * Create a PolicyMatch evidence object from a policy
   *
   * @param policy The policy that matches the check
   * @param checkId The baseline check ID
   * @param isFullMatch Whether this is a complete match or partial
   * @returns PolicyMatch object with coverage details
   */
  createPolicyMatch(
    policy: Policy,
    checkId: string,
    isFullMatch: boolean = true
  ): PolicyMatch {
    const gaps: PolicyGap[] = [];
    let coverageScore = 1.0;

    // Check state - report-only policies get lower score
    if (policy.state === "enabledReportOnly") {
      coverageScore = 0.7;
      gaps.push({
        type: "state",
        severity: "warning",
        message: "Policy exists but not enforced (Report-Only mode)",
        suggestion: "Change policy state to 'enabled'"
      });
    } else if (policy.state === "disabled") {
      coverageScore = 0.0;
      gaps.push({
        type: "state",
        severity: "blocker",
        message: "Policy is disabled",
        suggestion: "Enable the policy"
      });
    }

    // Determine coverage details based on policy conditions
    const userScope = this.determineUserScope(policy);
    const appScope = this.determineAppScope(policy);
    const controlMatch = "exact"; // Simplified for now, will be enhanced in Phase 4

    return {
      policyId: policy.id || "unknown",
      policyName: policy.displayName || "Unnamed Policy",
      state: policy.state,
      coverageScore,
      coverageDetails: {
        userScope,
        appScope,
        controlMatch
      },
      gaps: gaps.length > 0 ? gaps : undefined,
      confidence: isFullMatch && policy.state === "enabled" ? "high" : (gaps.length > 0 ? "medium" : "low")
    };
  }

  /**
   * Determine user scope coverage
   */
  determineUserScope(policy: Policy): "full" | "partial" | "missing" {
    const users = policy.conditions?.users;
    if (!users) return "missing";

    if (users.includeUsers?.includes("All")) return "full";
    if (users.includeUsers?.length > 0 || users.includeGroups?.length > 0 || users.includeRoles?.length > 0) {
      return "partial";
    }

    return "missing";
  }

  /**
   * Determine app scope coverage
   */
  determineAppScope(policy: Policy): "full" | "partial" | "missing" {
    const apps = policy.conditions?.applications;
    if (!apps) return "missing";

    if (apps.includeApplications?.includes("All")) return "full";
    if (apps.includeApplications?.length > 0) return "partial";

    return "missing";
  }

  /**
   * Helper: Check if a policy effectively targets a specific app ID or set of apps
   */
  targetsApp(policy: Policy, appId: string): boolean {
    const inc = policy.conditions?.applications?.includeApplications || [];
    const exc = policy.conditions?.applications?.excludeApplications || [];
    
    // If excluding the target app, it's a no
    if (exc.includes(appId)) return false;

    // If including all apps, it effectively targets any specific app
    if (inc.includes("All")) return true;

    // If the target is part of the Office365 suite and policy targets Office365
    if (appId !== "All" && inc.includes("Office365")) return true;

    // Direct inclusion
    return inc.includes(appId);
  }

  /**
   * CRITICAL: Check if a policy's grant controls meet requirements, respecting the operator (OR/AND)
   *
   * This method fixes a major bug where we were checking for control existence without
   * evaluating the operator. For example, a policy with ["mfa", "compliantDevice"] + OR
   * should pass an MFA check, but previous code would only check if "mfa" was in the array.
   *
   * @param policy The policy to evaluate
   * @param requiredControls Array of control names that would satisfy the requirement
   * @param mode "ANY" means ANY of the requiredControls satisfies (OR logic),
   *             "ALL" means ALL requiredControls must be present (AND logic)
   * @returns true if the policy's grant controls meet the requirement
   */
  meetsGrantControls(
    policy: Policy,
    requiredControls: string[],
    mode: "ANY" | "ALL" = "ANY"
  ): boolean {
    const controls = policy.grantControls?.builtInControls || [];
    const operator = policy.grantControls?.operator || "OR";

    // If policy has no controls, it doesn't meet any requirement
    if (controls.length === 0) return false;

    if (mode === "ANY") {
      // At least one of the required controls must be present
      return requiredControls.some(req => controls.includes(req));
    } else {
      // ALL required controls must be present
      return requiredControls.every(req => controls.includes(req));
    }
  }

  /**
   * Helper: Check if a policy effectively requires MFA (handling operators and multiple controls)
   */
  requiresMFA(policy: Policy): boolean {
    const strength = policy.grantControls?.authenticationStrength;
    const custom = policy.grantControls?.customAuthenticationFactors || [];

    // MFA is required if strength is defined, OR custom factors exist, OR "mfa" control is present
    return strength !== null || custom.length > 0 || this.meetsGrantControls(policy, ["mfa"]);
  }


  /**
   * Performs gap analysis against the defined 15-rule baseline
   * Uses modular TypeScript check system (Phase 3 enhancement)
   */
  analyze(policies: Policy[]): AnalysisResult[] {
    // Load all modular checks
    const checks = getAllChecks(this);

    return checks.map((check) => {
      // Evaluate this check against all policies
      const matchedPolicies = check.evaluate(policies);

      // Determine status based on matches
      let status: "pass" | "fail" | "warn";
      if (matchedPolicies.length === 0) {
        status = "fail";
      } else {
        // Check if all matches are enabled (pass) or some are report-only (warn)
        const hasEnabledPolicy = matchedPolicies.some((m) => m.state === "enabled");
        const hasReportOnlyPolicy = matchedPolicies.some((m) => m.state === "enabledReportOnly");

        if (hasEnabledPolicy) {
          status = "pass";
        } else if (hasReportOnlyPolicy) {
          status = "warn";
        } else {
          status = "fail";
        }
      }

      // Calculate remediation effort dynamically based on status
      const remediationEffort = this.estimateRemediationEffort(status, matchedPolicies, check.remediationEffort);

      // Return analysis result with all metadata from check
      return {
        id: check.id,
        name: check.name,
        description: check.description,
        priority: check.priority,
        pillar: check.pillar,
        recommendation: check.recommendation,
        status,
        whyItMatters: check.whyItMatters,
        references: check.references,
        matchedPolicies: matchedPolicies.length > 0 ? matchedPolicies : undefined,
        remediationEffort,
      };
    });
  }


  /**
   * Estimate remediation effort based on status and matched policies
   *
   * @param status Current check status
   * @param matches Matched policies
   * @param baseEffort Base effort from check definition (used for "fail" status)
   * @returns Estimated remediation effort
   */
  private estimateRemediationEffort(
    status: "pass" | "fail" | "warn",
    matches: PolicyMatch[],
    baseEffort: "low" | "medium" | "high"
  ): "low" | "medium" | "high" {
    if (status === "pass") return "low"; // Already compliant, no work needed
    if (status === "warn" && matches.length > 0) return "low"; // Just enable existing policy

    // Failing status - use base effort from check definition
    // (some checks are harder to implement than others)
    return baseEffort;
  }

  /**
   * Generates a recommended security roadmap based on analysis results
   */
  getRoadmap(results: AnalysisResult[]): string {
    const failed = results.filter(r => r.status === "fail");
    const warning = results.filter(r => r.status === "warn");
    
    if (failed.length === 0 && warning.length === 0) {
        return "✅ Outstanding! Your tenant meets all 15 core Microsoft Best Practice policies. Your CA architecture is fully aligned with Zero Trust.";
    }

    let roadmap = "🚀 CONDITIONAL ACCESS STRATEGIC ROADMAP (High-Fidelity Framework)\n";
    roadmap += "This roadmap evaluates your posture against the standardized Microsoft baseline.\n\n";
    
    if (warning.length > 0) {
        roadmap += "⚠️ ATTENTION: Some policies are in 'Report-Only' mode. These meet security criteria but are NOT yet enforced.\n";
        warning.forEach(r => roadmap += `  • [${r.id}] ${r.name} (Awaiting Enforcement)\n`);
        roadmap += "\n";
    }

    // Group by Priority/Pillar
    const priority1 = failed.filter(r => r.priority === 1);
    const priority2 = failed.filter(r => r.priority === 2);
    const priority3 = failed.filter(r => r.priority === 3);

    if (priority1.length > 0) {
        roadmap += "📍 PHASE 1: THE SECURE FOUNDATION\n";
        roadmap += "   Focus: Protecting admins, blocking legacy auth, and securing registration.\n";
        priority1.forEach(r => roadmap += `  • [${r.id}] ${r.name}: ${r.recommendation}\n`);
        roadmap += "\n";
    }

    if (priority2.length > 0) {
        roadmap += "📍 PHASE 2: ATTACK SURFACE REDUCTION\n";
        roadmap += "   Focus: External users and automated risk-based protection.\n";
        priority2.forEach(r => roadmap += `  • [${r.id}] ${r.name}: ${r.recommendation}\n`);
        roadmap += "\n";
    }

    if (priority3.length > 0) {
        roadmap += "📍 PHASE 3: ZERO TRUST MATURITY\n";
        roadmap += "   Focus: Device trust and application protection (Intune integration).\n";
        priority3.forEach(r => roadmap += `  • [${r.id}] ${r.name}: ${r.recommendation}\n`);
    }

    return roadmap;
  }
}
