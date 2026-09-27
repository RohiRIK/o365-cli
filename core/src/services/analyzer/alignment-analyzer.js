/**
 * Policy Alignment Analyzer
 *
 * Analyzes individual policy matches to determine alignment status,
 * exclusion impacts, and generate detailed gap recommendations.
 *
 * This service enhances PolicyMatch objects with:
 * - Alignment status ("Aligned" | "Partially Aligned" | "Not Aligned")
 * - Exclusion impact analysis (coverage reduction percentage)
 * - Detailed gaps with specific remediation suggestions
 */
export class AlignmentAnalyzer {
    /**
     * Enhance a PolicyMatch with alignment analysis
     *
     * @param match The original PolicyMatch from check evaluation
     * @param policy The full Policy object from Graph API
     * @param checkId The baseline check ID being analyzed
     * @returns Enhanced PolicyMatch with alignment details
     */
    analyzeMatch(match, policy, checkId) {
        const alignment = this.determineAlignment(match, policy);
        const enhancedGaps = this.generateDetailedGaps(match, policy, alignment);
        return {
            ...match,
            alignmentStatus: alignment.status,
            alignmentScore: alignment.score,
            exclusionImpact: alignment.exclusionImpact,
            gaps: enhancedGaps,
        };
    }
    /**
     * Determine alignment status and score for a policy
     *
     * Scoring algorithm:
     * - Start: 100 points
     * - Report-only: -30 points
     * - Disabled: 0 points (Not Aligned)
     * - Exclusions: -5 to -40 points based on coverage reduction
     * - Partial user scope: -20 points
     * - Partial app scope: -10 points
     *
     * Thresholds:
     * - 85-100 pts: "Aligned"
     * - 50-84 pts: "Partially Aligned"
     * - <50 pts: "Not Aligned"
     */
    determineAlignment(match, policy) {
        let score = 100;
        const issues = [];
        // CRITICAL: Disabled policies = Not Aligned (0 points)
        if (policy.state === "disabled") {
            return {
                status: "Not Aligned",
                score: 0,
                issues: ["disabled"],
            };
        }
        // Report-only penalty (-30 points)
        if (policy.state === "enabledReportOnly") {
            score -= 30;
            issues.push("report-only");
        }
        // Exclusion analysis
        const exclusionImpact = this.calculateExclusionImpact(policy);
        if (exclusionImpact.percentage > 0) {
            score -= exclusionImpact.penalty;
            issues.push(`excludes-${exclusionImpact.percentage}%-coverage`);
            if (exclusionImpact.highRisk) {
                issues.push("high-risk-exclusions");
            }
        }
        // Coverage scope penalties
        if (match.coverageDetails.userScope === "partial") {
            score -= 20;
            issues.push("partial-user-scope");
        }
        if (match.coverageDetails.appScope === "partial") {
            score -= 10;
            issues.push("partial-app-scope");
        }
        // Control strength penalties (if implemented in future)
        if (match.coverageDetails.controlMatch === "weaker") {
            score -= 15;
            issues.push("weaker-controls");
        }
        // Ensure score doesn't go negative
        score = Math.max(0, score);
        // Determine status based on final score
        let status;
        if (score >= 85) {
            status = "Aligned";
        }
        else if (score >= 50) {
            status = "Partially Aligned";
        }
        else {
            status = "Not Aligned";
        }
        return {
            status,
            score,
            exclusionImpact: exclusionImpact.percentage > 0 ? exclusionImpact : undefined,
            issues,
        };
    }
    /**
     * Calculate exclusion impact using heuristic estimation
     *
     * Since we don't have real-time tenant user/group counts, we use
     * heuristics to estimate coverage reduction:
     * - Each excluded user: ~1% impact
     * - Each excluded group: ~15% impact
     * - Each excluded role: ~5% impact
     * - Each excluded app: ~5% impact
     *
     * Penalty curve:
     * - 0-10%: -5 points
     * - 10-30%: -20 points
     * - 30%+: -40 points
     */
    calculateExclusionImpact(policy) {
        const exclusions = {
            users: policy.conditions?.users?.excludeUsers || [],
            groups: policy.conditions?.users?.excludeGroups || [],
            roles: policy.conditions?.users?.excludeRoles || [],
            apps: policy.conditions?.applications?.excludeApplications || [],
            platforms: policy.conditions?.platforms?.excludePlatforms || [],
        };
        // Heuristic-based estimation
        let estimatedImpact = 0;
        let penalty = 0;
        let highRisk = false;
        // User exclusions (each user ~1%, groups ~15%, roles ~5%)
        estimatedImpact += exclusions.users.length * 1;
        estimatedImpact += exclusions.groups.length * 15;
        estimatedImpact += exclusions.roles.length * 5;
        // App exclusions (critical apps flag high risk)
        if (exclusions.apps.length > 0) {
            estimatedImpact += exclusions.apps.length * 5;
            // High-risk: Critical apps excluded
            const criticalApps = ["Office365", "MicrosoftAdminPortals", "All"];
            highRisk = exclusions.apps.some((app) => criticalApps.includes(app));
        }
        // Platform exclusions
        estimatedImpact += exclusions.platforms.length * 10;
        // Cap at 100%
        estimatedImpact = Math.min(100, estimatedImpact);
        // Penalty curve
        if (estimatedImpact > 30) {
            penalty = 40;
        }
        else if (estimatedImpact > 10) {
            penalty = 20;
        }
        else if (estimatedImpact > 0) {
            penalty = 5;
        }
        // Suggest compensating controls
        const compensating = [];
        if (exclusions.users.length > 0 || exclusions.groups.length > 0) {
            compensating.push("Implement network location restrictions for excluded users");
            compensating.push("Require device compliance for excluded accounts");
        }
        if (exclusions.apps.length > 0) {
            compensating.push("Create dedicated policy for excluded applications");
        }
        if (exclusions.roles.length > 0) {
            compensating.push("Implement stronger controls for excluded roles");
        }
        return {
            percentage: Math.round(estimatedImpact),
            penalty,
            highRisk,
            compensatingControls: compensating.length > 0 ? compensating : undefined,
        };
    }
    /**
     * Generate detailed gaps with specific remediation suggestions
     *
     * Enhances existing gaps with:
     * - Exclusion-specific gaps
     * - Scope coverage gaps
     * - Control strength gaps
     */
    generateDetailedGaps(match, policy, alignment) {
        const gaps = [...(match.gaps || [])];
        // Add exclusion-specific gaps
        if (alignment.exclusionImpact && alignment.exclusionImpact.percentage > 0) {
            const severity = alignment.exclusionImpact.highRisk ? "blocker" : "warning";
            const message = `Policy excludes ${alignment.exclusionImpact.percentage}% of scope${alignment.exclusionImpact.highRisk ? " (includes critical apps/users)" : ""}`;
            gaps.push({
                type: "exclusions",
                severity,
                message,
                suggestion: alignment.exclusionImpact.compensatingControls?.[0] ||
                    "Review exclusions and implement compensating controls",
            });
        }
        // Add scope coverage gaps
        if (match.coverageDetails.userScope === "partial") {
            gaps.push({
                type: "scope",
                severity: "warning",
                message: "Policy targets partial user scope (not all users)",
                suggestion: "Expand user scope to 'All users' or create additional policies for coverage gaps",
            });
        }
        if (match.coverageDetails.appScope === "partial") {
            gaps.push({
                type: "scope",
                severity: "warning",
                message: "Policy targets partial app scope (not all apps)",
                suggestion: "Expand app scope to 'All cloud apps' or verify specific apps are intentional",
            });
        }
        // Add control strength gaps (if weaker controls detected)
        if (match.coverageDetails.controlMatch === "weaker") {
            gaps.push({
                type: "control",
                severity: "warning",
                message: "Policy uses weaker controls than recommended",
                suggestion: "Upgrade to stronger controls (e.g., phishing-resistant MFA, device compliance)",
            });
        }
        return gaps;
    }
}
