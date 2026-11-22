/**
 * Maturity Calculator Service
 *
 * Calculates 0-100% CA security maturity score with priority weighting.
 *
 * Scoring algorithm:
 * - Group checks by priority (1, 2, 3)
 * - Per-priority scores: Pass=100%, Warn=70%, Fail=0%
 * - Weighted average: Overall = (P1×0.40) + (P2×0.35) + (P3×0.25)
 *
 * Priority weights rationale:
 * - Priority 1 (40%): Foundation controls (MFA, legacy auth) - must-haves
 * - Priority 2 (35%): Attack surface reduction (risk-based, guest) - important
 * - Priority 3 (25%): Advanced Zero Trust (device compliance, sessions) - nice-to-haves
 */

import type { AnalysisResult } from "./ca-baseline";

export interface MaturityScore {
  overall: number; // 0-100 percentage
  byPriority: {
    priority1: number; // 0-100
    priority2: number;
    priority3: number;
  };
  breakdown: {
    passed: number;
    partial: number; // Report-only or warnings
    failed: number;
  };
  weightedContribution: {
    priority1: number; // 0-40 (40% weight)
    priority2: number; // 0-35 (35% weight)
    priority3: number; // 0-25 (25% weight)
  };
}

export class MaturityCalculator {
  // Priority weights (must sum to 1.0)
  private readonly PRIORITY_WEIGHTS = {
    1: 0.4, // 40% - Critical foundation controls
    2: 0.35, // 35% - Attack surface reduction
    3: 0.25, // 25% - Advanced Zero Trust
  };

  // Report-only contribution (policies exist but not enforced)
  private readonly WARNING_CONTRIBUTION = 0.7; // 70%

  /**
   * Calculate maturity score from analysis results
   *
   * @param results Array of AnalysisResult from CABaselineAnalyzer
   * @returns MaturityScore with overall percentage and breakdowns
   */
  public calculate(results: AnalysisResult[]): MaturityScore {
    // Group results by priority
    const byPriority = this.groupByPriority(results);

    // Calculate per-priority scores
    const priorityScores = {
      priority1: this.calculatePriorityScore(byPriority[1] || []),
      priority2: this.calculatePriorityScore(byPriority[2] || []),
      priority3: this.calculatePriorityScore(byPriority[3] || []),
    };

    // Calculate weighted contributions
    const weightedContribution = {
      priority1: Math.round(priorityScores.priority1 * this.PRIORITY_WEIGHTS[1]),
      priority2: Math.round(priorityScores.priority2 * this.PRIORITY_WEIGHTS[2]),
      priority3: Math.round(priorityScores.priority3 * this.PRIORITY_WEIGHTS[3]),
    };

    // Calculate overall score
    const overall = Math.round(
      priorityScores.priority1 * this.PRIORITY_WEIGHTS[1] +
        priorityScores.priority2 * this.PRIORITY_WEIGHTS[2] +
        priorityScores.priority3 * this.PRIORITY_WEIGHTS[3]
    );

    // Calculate breakdown
    const breakdown = {
      passed: results.filter((r) => r.status === "pass").length,
      partial: results.filter((r) => r.status === "warn").length,
      failed: results.filter((r) => r.status === "fail").length,
    };

    return {
      overall,
      byPriority: priorityScores,
      breakdown,
      weightedContribution,
    };
  }

  /**
   * Generate human-readable maturity summary
   *
   * Format:
   * CA Security Maturity: 73% (Strong)
   *
   * Priority Breakdown:
   *   - Critical Controls (P1): 85% (contributes 34 pts)
   *   - Attack Surface (P2):   65% (contributes 23 pts)
   *   - Zero Trust (P3):       62% (contributes 16 pts)
   *
   * Check Status:
   *   ✓ Passed:  18
   *   ⚠ Partial: 4
   *   ✗ Failed:  5
   *
   * @param score MaturityScore object from calculate()
   * @returns Formatted summary string
   */
  public getSummary(score: MaturityScore): string {
    const level = this.getMaturityLevel(score.overall);

    let summary = `CA Security Maturity: ${score.overall}% (${level})\n\n`;

    summary += "Priority Breakdown:\n";
    summary += `  - Critical Controls (P1): ${score.byPriority.priority1}% (contributes ${score.weightedContribution.priority1} pts)\n`;
    summary += `  - Attack Surface (P2):   ${score.byPriority.priority2}% (contributes ${score.weightedContribution.priority2} pts)\n`;
    summary += `  - Zero Trust (P3):       ${score.byPriority.priority3}% (contributes ${score.weightedContribution.priority3} pts)\n\n`;

    summary += "Check Status:\n";
    summary += `  ✓ Passed:  ${score.breakdown.passed}\n`;
    summary += `  ⚠ Partial: ${score.breakdown.partial}\n`;
    summary += `  ✗ Failed:  ${score.breakdown.failed}`;

    return summary;
  }

  /**
   * Get descriptive maturity level from percentage score
   *
   * Thresholds:
   * - 90-100%: Excellent
   * - 75-89%:  Strong
   * - 60-74%:  Moderate
   * - 40-59%:  Weak
   * - 0-39%:   Critical
   *
   * @param score Overall maturity percentage (0-100)
   * @returns Descriptive level string
   */
  public getMaturityLevel(score: number): string {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Strong";
    if (score >= 60) return "Moderate";
    if (score >= 40) return "Weak";
    return "Critical";
  }

  /**
   * Group analysis results by priority level
   *
   * @param results Array of AnalysisResult
   * @returns Record<priority, AnalysisResult[]>
   */
  private groupByPriority(results: AnalysisResult[]): Record<number, AnalysisResult[]> {
    const grouped: Record<number, AnalysisResult[]> = {
      1: [],
      2: [],
      3: [],
    };

    for (const result of results) {
      const priority = result.priority || 3; // Default to P3 if missing
      if (!grouped[priority]) {
        grouped[priority] = [];
      }
      grouped[priority].push(result);
    }

    return grouped;
  }

  /**
   * Calculate score for a single priority level
   *
   * Algorithm:
   * - Pass: 100% contribution
   * - Warn: 70% contribution (report-only)
   * - Fail: 0% contribution
   * - Average across all checks in priority
   *
   * @param results Array of AnalysisResult for a single priority
   * @returns Score percentage (0-100)
   */
  private calculatePriorityScore(results: AnalysisResult[]): number {
    if (results.length === 0) {
      return 100; // No checks in this priority = perfect score
    }

    let totalScore = 0;

    for (const result of results) {
      if (result.status === "pass") {
        totalScore += 100;
      } else if (result.status === "warn") {
        totalScore += 100 * this.WARNING_CONTRIBUTION; // 70%
      } else {
        totalScore += 0; // fail
      }
    }

    return Math.round(totalScore / results.length);
  }
}
