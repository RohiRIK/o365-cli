/**
 * Conflict Detector Service
 *
 * Identifies overlapping, contradictory, or redundant Conditional Access policies.
 *
 * Detection algorithm:
 * - For each enabled policy pair:
 *   1. Calculate scope overlap (user/app/platform intersection)
 *   2. If overlap < 10%, skip (insufficient overlap)
 *   3. Detect contradictions (BLOCK vs GRANT)
 *   4. Detect redundancies (same controls, >80% overlap)
 *   5. Detect overlaps (similar scope, different controls)
 *
 * Conflict types:
 * - Contradiction (critical): One blocks, other grants for same scope
 * - Redundancy (info): Same controls, high overlap (may be intentional defense-in-depth)
 * - Overlap (warning): Similar scope, different controls (potential confusion)
 */

import type { Policy } from "./ca-baseline";

export interface PolicyConflict {
  policy1: { id: string; name: string };
  policy2: { id: string; name: string };
  conflictType: "contradiction" | "overlap" | "redundancy";
  severity: "critical" | "warning" | "info";
  description: string;
  affectedScope: {
    users?: string;
    apps?: string;
    platforms?: string;
  };
}

interface ScopeOverlap {
  percentage: number; // 0-100 aggregate overlap
  userOverlap: number; // 0-100
  appOverlap: number; // 0-100
  platformOverlap: number; // 0-100
}

export class ConflictDetector {
  // Minimum overlap percentage to consider for conflict detection
  private readonly MIN_OVERLAP_THRESHOLD = 10;

  // High overlap threshold for redundancy detection
  private readonly REDUNDANCY_THRESHOLD = 80;

  /**
   * Detect conflicts across all enabled policies
   *
   * @param policies Array of Policy objects from Graph API
   * @returns Array of PolicyConflict objects
   */
  public detect(policies: Policy[]): PolicyConflict[] {
    const conflicts: PolicyConflict[] = [];

    // Only analyze enabled policies (skip disabled and report-only for conflict detection)
    const enabledPolicies = policies.filter((p) => p.state === "enabled");

    // Compare each policy pair (O(n²) complexity)
    for (let i = 0; i < enabledPolicies.length; i++) {
      for (let j = i + 1; j < enabledPolicies.length; j++) {
        const p1 = enabledPolicies[i];
        const p2 = enabledPolicies[j];

        // Calculate scope overlap
        const overlap = this.calculateScopeOverlap(p1, p2);

        // Skip if insufficient overlap
        if (overlap.percentage < this.MIN_OVERLAP_THRESHOLD) {
          continue;
        }

        // Detect contradictions (critical)
        const contradiction = this.detectContradiction(p1, p2, overlap);
        if (contradiction) {
          conflicts.push(contradiction);
          continue; // Don't double-report as overlap/redundancy
        }

        // Detect redundancies (info)
        const redundancy = this.detectRedundancy(p1, p2, overlap);
        if (redundancy) {
          conflicts.push(redundancy);
          continue;
        }

        // Detect general overlap (warning)
        const overlapConflict = this.detectOverlap(p1, p2, overlap);
        if (overlapConflict) {
          conflicts.push(overlapConflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Format conflicts into human-readable report
   *
   * Groups by severity:
   * - 🚨 CRITICAL: Contradictions
   * - ⚠️ WARNINGS: Overlaps
   * - ℹ️ INFO: Redundancies
   *
   * @param conflicts Array of PolicyConflict
   * @returns Formatted report string
   */
  public formatConflicts(conflicts: PolicyConflict[]): string {
    if (conflicts.length === 0) {
      return "No policy conflicts detected.";
    }

    let report = "POLICY CONFLICT ANALYSIS\n";
    report += "=".repeat(80) + "\n\n";

    // Group by severity
    const critical = conflicts.filter((c) => c.severity === "critical");
    const warnings = conflicts.filter((c) => c.severity === "warning");
    const info = conflicts.filter((c) => c.severity === "info");

    // Critical contradictions
    if (critical.length > 0) {
      report += "🚨 CRITICAL CONTRADICTIONS:\n";
      report += "-".repeat(80) + "\n";
      for (const conflict of critical) {
        report += `\nPolicy 1: ${conflict.policy1.name}\n`;
        report += `Policy 2: ${conflict.policy2.name}\n`;
        report += `Issue: ${conflict.description}\n`;
        report += `Affected Scope:\n`;
        if (conflict.affectedScope.users) report += `  - Users: ${conflict.affectedScope.users}\n`;
        if (conflict.affectedScope.apps) report += `  - Apps: ${conflict.affectedScope.apps}\n`;
        if (conflict.affectedScope.platforms)
          report += `  - Platforms: ${conflict.affectedScope.platforms}\n`;
        report += "\n";
      }
    }

    // Warnings
    if (warnings.length > 0) {
      report += "⚠️ WARNINGS (Potential Issues):\n";
      report += "-".repeat(80) + "\n";
      for (const conflict of warnings) {
        report += `\nPolicy 1: ${conflict.policy1.name}\n`;
        report += `Policy 2: ${conflict.policy2.name}\n`;
        report += `Issue: ${conflict.description}\n`;
        report += "\n";
      }
    }

    // Info (redundancies)
    if (info.length > 0) {
      report += "ℹ️ INFO (Redundancies - May Be Intentional):\n";
      report += "-".repeat(80) + "\n";
      for (const conflict of info) {
        report += `\nPolicy 1: ${conflict.policy1.name}\n`;
        report += `Policy 2: ${conflict.policy2.name}\n`;
        report += `Note: ${conflict.description}\n`;
        report += "\n";
      }
    }

    return report;
  }

  /**
   * Calculate scope overlap between two policies
   *
   * Heuristics:
   * - Both target "All" → 100% overlap
   * - One targets "All" → 50% overlap
   * - Common specific groups/apps → 30% overlap
   * - No intersection → 0% overlap
   *
   * Aggregate: (userOverlap + appOverlap + platformOverlap) / 3
   *
   * @param p1 First policy
   * @param p2 Second policy
   * @returns ScopeOverlap object with percentage breakdowns
   */
  private calculateScopeOverlap(p1: Policy, p2: Policy): ScopeOverlap {
    // User scope overlap
    const userOverlap = this.calculateUserOverlap(p1, p2);

    // App scope overlap
    const appOverlap = this.calculateAppOverlap(p1, p2);

    // Platform scope overlap
    const platformOverlap = this.calculatePlatformOverlap(p1, p2);

    // Aggregate percentage (average of all dimensions)
    const percentage = Math.round((userOverlap + appOverlap + platformOverlap) / 3);

    return {
      percentage,
      userOverlap,
      appOverlap,
      platformOverlap,
    };
  }

  /**
   * Calculate user scope overlap between two policies
   */
  private calculateUserOverlap(p1: Policy, p2: Policy): number {
    const p1Users = p1.conditions?.users?.includeUsers || [];
    const p2Users = p2.conditions?.users?.includeUsers || [];

    // Both target all users
    if (p1Users.includes("All") && p2Users.includes("All")) {
      return 100;
    }

    // One targets all users
    if (p1Users.includes("All") || p2Users.includes("All")) {
      return 50;
    }

    // Check for specific user intersection
    const intersection = p1Users.filter((user) => p2Users.includes(user));
    if (intersection.length > 0) {
      return 30; // Heuristic: Some common users
    }

    // Check for group overlap
    const p1Groups = p1.conditions?.users?.includeGroups || [];
    const p2Groups = p2.conditions?.users?.includeGroups || [];
    const groupIntersection = p1Groups.filter((group) => p2Groups.includes(group));
    if (groupIntersection.length > 0) {
      return 30; // Heuristic: Some common groups
    }

    return 0; // No overlap
  }

  /**
   * Calculate app scope overlap between two policies
   */
  private calculateAppOverlap(p1: Policy, p2: Policy): number {
    const p1Apps = p1.conditions?.applications?.includeApplications || [];
    const p2Apps = p2.conditions?.applications?.includeApplications || [];

    // Both target all apps
    if (p1Apps.includes("All") && p2Apps.includes("All")) {
      return 100;
    }

    // One targets all apps
    if (p1Apps.includes("All") || p2Apps.includes("All")) {
      return 50;
    }

    // Check for specific app intersection
    const intersection = p1Apps.filter((app) => p2Apps.includes(app));
    if (intersection.length > 0) {
      return 30; // Heuristic: Some common apps
    }

    return 0; // No overlap
  }

  /**
   * Calculate platform scope overlap between two policies
   */
  private calculatePlatformOverlap(p1: Policy, p2: Policy): number {
    const p1Platforms = p1.conditions?.platforms?.includePlatforms || [];
    const p2Platforms = p2.conditions?.platforms?.includePlatforms || [];

    // No platform targeting = assume all platforms
    if (p1Platforms.length === 0 && p2Platforms.length === 0) {
      return 100;
    }

    // One has no platform restriction
    if (p1Platforms.length === 0 || p2Platforms.length === 0) {
      return 50;
    }

    // Check for specific platform intersection
    const intersection = p1Platforms.filter((platform) => p2Platforms.includes(platform));
    if (intersection.length > 0) {
      return Math.round((intersection.length / Math.max(p1Platforms.length, p2Platforms.length)) * 100);
    }

    return 0; // No overlap
  }

  /**
   * Detect contradiction: One policy blocks, other grants for overlapping scope
   *
   * @returns PolicyConflict if contradiction found, null otherwise
   */
  private detectContradiction(
    p1: Policy,
    p2: Policy,
    overlap: ScopeOverlap
  ): PolicyConflict | null {
    const p1Blocks = p1.grantControls?.builtInControls?.includes("block") || false;
    const p2Blocks = p2.grantControls?.builtInControls?.includes("block") || false;

    // Contradiction: One blocks, other grants (doesn't block)
    if (p1Blocks !== p2Blocks) {
      const blockingPolicy = p1Blocks ? p1 : p2;
      const grantingPolicy = p1Blocks ? p2 : p1;

      return {
        policy1: { id: blockingPolicy.id, name: blockingPolicy.displayName },
        policy2: { id: grantingPolicy.id, name: grantingPolicy.displayName },
        conflictType: "contradiction",
        severity: "critical",
        description: `Policy "${blockingPolicy.displayName}" blocks access while policy "${grantingPolicy.displayName}" grants access for overlapping scope (${overlap.percentage}% overlap)`,
        affectedScope: {
          users: overlap.userOverlap > 0 ? `${overlap.userOverlap}% user overlap` : undefined,
          apps: overlap.appOverlap > 0 ? `${overlap.appOverlap}% app overlap` : undefined,
          platforms:
            overlap.platformOverlap > 0 ? `${overlap.platformOverlap}% platform overlap` : undefined,
        },
      };
    }

    return null;
  }

  /**
   * Detect redundancy: Both policies require same controls for high overlap
   *
   * @returns PolicyConflict if redundancy found, null otherwise
   */
  private detectRedundancy(
    p1: Policy,
    p2: Policy,
    overlap: ScopeOverlap
  ): PolicyConflict | null {
    // Only flag if high overlap (>80%)
    if (overlap.percentage < this.REDUNDANCY_THRESHOLD) {
      return null;
    }

    // Check if both require MFA
    const p1RequiresMfa = p1.grantControls?.builtInControls?.includes("mfa") || false;
    const p2RequiresMfa = p2.grantControls?.builtInControls?.includes("mfa") || false;

    if (p1RequiresMfa && p2RequiresMfa) {
      return {
        policy1: { id: p1.id, name: p1.displayName },
        policy2: { id: p2.id, name: p2.displayName },
        conflictType: "redundancy",
        severity: "info",
        description: `Both policies require MFA for ${overlap.percentage}% overlapping scope. This may be intentional defense-in-depth or redundant configuration.`,
        affectedScope: {},
      };
    }

    // Check if both block
    const p1Blocks = p1.grantControls?.builtInControls?.includes("block") || false;
    const p2Blocks = p2.grantControls?.builtInControls?.includes("block") || false;

    if (p1Blocks && p2Blocks) {
      return {
        policy1: { id: p1.id, name: p1.displayName },
        policy2: { id: p2.id, name: p2.displayName },
        conflictType: "redundancy",
        severity: "info",
        description: `Both policies block access for ${overlap.percentage}% overlapping scope. Consider consolidating into a single policy.`,
        affectedScope: {},
      };
    }

    return null;
  }

  /**
   * Detect general overlap: Similar scope, different controls
   *
   * @returns PolicyConflict if overlap detected, null otherwise
   */
  private detectOverlap(p1: Policy, p2: Policy, overlap: ScopeOverlap): PolicyConflict | null {
    // Only flag moderate overlap (not high enough to be redundant)
    if (overlap.percentage >= this.REDUNDANCY_THRESHOLD) {
      return null; // Already handled by redundancy check
    }

    // Different controls applied to overlapping scope
    return {
      policy1: { id: p1.id, name: p1.displayName },
      policy2: { id: p2.id, name: p2.displayName },
      conflictType: "overlap",
      severity: "warning",
      description: `Policies have ${overlap.percentage}% overlapping scope with different controls. Verify this is intentional.`,
      affectedScope: {},
    };
  }
}
