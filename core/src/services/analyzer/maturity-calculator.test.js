/**
 * MaturityCalculator Unit Tests
 *
 * Tests for 0-100% CA maturity scoring including:
 * - Priority weighting (40/35/25%)
 * - Warning contribution (70%)
 * - Edge cases (all pass, all fail, no checks)
 * - Summary formatting
 */
import { describe, it, expect } from "bun:test";
import { MaturityCalculator } from "./maturity-calculator";
describe("MaturityCalculator", () => {
    const calculator = new MaturityCalculator();
    // Helper to create minimal AnalysisResult object
    const createResult = (overrides = {}) => {
        return {
            id: "TEST001",
            name: "Test Check",
            description: "Test description",
            status: "pass",
            recommendation: "Test recommendation",
            pillar: "Foundation",
            priority: 1,
            ...overrides,
        };
    };
    describe("calculate", () => {
        it("should return 100% for all passing checks", () => {
            const results = [
                createResult({ id: "P1-1", priority: 1, status: "pass" }),
                createResult({ id: "P1-2", priority: 1, status: "pass" }),
                createResult({ id: "P2-1", priority: 2, status: "pass" }),
                createResult({ id: "P2-2", priority: 2, status: "pass" }),
                createResult({ id: "P3-1", priority: 3, status: "pass" }),
                createResult({ id: "P3-2", priority: 3, status: "pass" }),
            ];
            const score = calculator.calculate(results);
            expect(score.overall).toBe(100);
            expect(score.byPriority.priority1).toBe(100);
            expect(score.byPriority.priority2).toBe(100);
            expect(score.byPriority.priority3).toBe(100);
        });
        it("should return 0% for all failing checks", () => {
            const results = [
                createResult({ id: "P1-1", priority: 1, status: "fail" }),
                createResult({ id: "P1-2", priority: 1, status: "fail" }),
                createResult({ id: "P2-1", priority: 2, status: "fail" }),
                createResult({ id: "P2-2", priority: 2, status: "fail" }),
                createResult({ id: "P3-1", priority: 3, status: "fail" }),
                createResult({ id: "P3-2", priority: 3, status: "fail" }),
            ];
            const score = calculator.calculate(results);
            expect(score.overall).toBe(0);
            expect(score.byPriority.priority1).toBe(0);
            expect(score.byPriority.priority2).toBe(0);
            expect(score.byPriority.priority3).toBe(0);
        });
        it("should calculate correct breakdown counts", () => {
            const results = [
                createResult({ id: "1", status: "pass" }),
                createResult({ id: "2", status: "pass" }),
                createResult({ id: "3", status: "warn" }),
                createResult({ id: "4", status: "fail" }),
                createResult({ id: "5", status: "fail" }),
            ];
            const score = calculator.calculate(results);
            expect(score.breakdown.passed).toBe(2);
            expect(score.breakdown.partial).toBe(1);
            expect(score.breakdown.failed).toBe(2);
        });
    });
    describe("Priority Weighting", () => {
        it("should weight Priority 1 at 40%", () => {
            const results = [
                // P1: 50% (1 pass, 1 fail)
                createResult({ id: "P1-1", priority: 1, status: "pass" }),
                createResult({ id: "P1-2", priority: 1, status: "fail" }),
                // P2: 100% (all pass)
                createResult({ id: "P2-1", priority: 2, status: "pass" }),
                createResult({ id: "P2-2", priority: 2, status: "pass" }),
                // P3: 100% (all pass)
                createResult({ id: "P3-1", priority: 3, status: "pass" }),
                createResult({ id: "P3-2", priority: 3, status: "pass" }),
            ];
            const score = calculator.calculate(results);
            expect(score.byPriority.priority1).toBe(50);
            expect(score.weightedContribution.priority1).toBe(20); // 50% * 40% = 20 pts
            // Overall = 20 (P1) + 35 (P2) + 25 (P3) = 80
            expect(score.overall).toBe(80);
        });
        it("should weight Priority 2 at 35%", () => {
            const results = [
                // P1: 100%
                createResult({ id: "P1-1", priority: 1, status: "pass" }),
                createResult({ id: "P1-2", priority: 1, status: "pass" }),
                // P2: 50% (1 pass, 1 fail)
                createResult({ id: "P2-1", priority: 2, status: "pass" }),
                createResult({ id: "P2-2", priority: 2, status: "fail" }),
                // P3: 100%
                createResult({ id: "P3-1", priority: 3, status: "pass" }),
                createResult({ id: "P3-2", priority: 3, status: "pass" }),
            ];
            const score = calculator.calculate(results);
            expect(score.byPriority.priority2).toBe(50);
            expect(score.weightedContribution.priority2).toBe(18); // 50% * 35% = 17.5 → 18
            // Overall = 40 (P1) + 18 (P2) + 25 (P3) = 83
            expect(score.overall).toBe(83);
        });
        it("should weight Priority 3 at 25%", () => {
            const results = [
                // P1: 100%
                createResult({ id: "P1-1", priority: 1, status: "pass" }),
                createResult({ id: "P1-2", priority: 1, status: "pass" }),
                // P2: 100%
                createResult({ id: "P2-1", priority: 2, status: "pass" }),
                createResult({ id: "P2-2", priority: 2, status: "pass" }),
                // P3: 50% (1 pass, 1 fail)
                createResult({ id: "P3-1", priority: 3, status: "pass" }),
                createResult({ id: "P3-2", priority: 3, status: "fail" }),
            ];
            const score = calculator.calculate(results);
            expect(score.byPriority.priority3).toBe(50);
            expect(score.weightedContribution.priority3).toBe(13); // 50% * 25% = 12.5 → 13
            // Overall = 40 (P1) + 35 (P2) + 13 (P3) = 88
            expect(score.overall).toBe(88);
        });
        it("should demonstrate Priority 1 has highest impact", () => {
            // Scenario 1: P1 fails, others pass
            const scenario1 = [
                createResult({ id: "P1-1", priority: 1, status: "fail" }),
                createResult({ id: "P2-1", priority: 2, status: "pass" }),
                createResult({ id: "P3-1", priority: 3, status: "pass" }),
            ];
            const score1 = calculator.calculate(scenario1);
            // 0 (P1) + 35 (P2) + 25 (P3) = 60
            // Scenario 2: P3 fails, others pass
            const scenario2 = [
                createResult({ id: "P1-1", priority: 1, status: "pass" }),
                createResult({ id: "P2-1", priority: 2, status: "pass" }),
                createResult({ id: "P3-1", priority: 3, status: "fail" }),
            ];
            const score2 = calculator.calculate(scenario2);
            // 40 (P1) + 35 (P2) + 0 (P3) = 75
            expect(score1.overall).toBe(60); // P1 failure hurts more
            expect(score2.overall).toBe(75); // P3 failure hurts less
            expect(score2.overall).toBeGreaterThan(score1.overall);
        });
    });
    describe("Warning Contribution", () => {
        it("should count warnings as 70% contribution", () => {
            const results = [
                createResult({ id: "1", priority: 1, status: "warn" }),
                createResult({ id: "2", priority: 1, status: "warn" }),
            ];
            const score = calculator.calculate(results);
            expect(score.byPriority.priority1).toBe(70); // 70% per warning
        });
        it("should correctly mix pass/warn/fail contributions", () => {
            const results = [
                createResult({ id: "1", priority: 1, status: "pass" }), // 100%
                createResult({ id: "2", priority: 1, status: "warn" }), // 70%
                createResult({ id: "3", priority: 1, status: "fail" }), // 0%
            ];
            const score = calculator.calculate(results);
            // (100 + 70 + 0) / 3 = 56.67 → 57
            expect(score.byPriority.priority1).toBe(57);
        });
    });
    describe("Edge Cases", () => {
        it("should handle empty results array", () => {
            const results = [];
            const score = calculator.calculate(results);
            expect(score.overall).toBe(100); // No checks = perfect score
            expect(score.breakdown.passed).toBe(0);
            expect(score.breakdown.partial).toBe(0);
            expect(score.breakdown.failed).toBe(0);
        });
        it("should handle priority with no checks (returns 100%)", () => {
            const results = [
                createResult({ id: "1", priority: 1, status: "pass" }),
                // No P2 checks
                createResult({ id: "3", priority: 3, status: "pass" }),
            ];
            const score = calculator.calculate(results);
            expect(score.byPriority.priority2).toBe(100); // No checks in P2 = 100%
        });
        it("should handle mixed priorities correctly", () => {
            const results = [
                createResult({ id: "1", priority: 1, status: "pass" }),
                createResult({ id: "2", priority: 1, status: "pass" }),
                createResult({ id: "3", priority: 1, status: "fail" }),
                createResult({ id: "4", priority: 2, status: "warn" }),
                createResult({ id: "5", priority: 3, status: "pass" }),
                createResult({ id: "6", priority: 3, status: "fail" }),
            ];
            const score = calculator.calculate(results);
            // P1: (100 + 100 + 0) / 3 = 66.67 → 67
            expect(score.byPriority.priority1).toBe(67);
            // P2: 70 / 1 = 70
            expect(score.byPriority.priority2).toBe(70);
            // P3: (100 + 0) / 2 = 50
            expect(score.byPriority.priority3).toBe(50);
            // Overall: (67 * 0.40) + (70 * 0.35) + (50 * 0.25)
            // = 26.8 + 24.5 + 12.5 = 63.8 → 64
            expect(score.overall).toBe(64);
        });
    });
    describe("getMaturityLevel", () => {
        it("should return 'Excellent' for 90-100%", () => {
            expect(calculator.getMaturityLevel(100)).toBe("Excellent");
            expect(calculator.getMaturityLevel(95)).toBe("Excellent");
            expect(calculator.getMaturityLevel(90)).toBe("Excellent");
        });
        it("should return 'Strong' for 75-89%", () => {
            expect(calculator.getMaturityLevel(89)).toBe("Strong");
            expect(calculator.getMaturityLevel(80)).toBe("Strong");
            expect(calculator.getMaturityLevel(75)).toBe("Strong");
        });
        it("should return 'Moderate' for 60-74%", () => {
            expect(calculator.getMaturityLevel(74)).toBe("Moderate");
            expect(calculator.getMaturityLevel(65)).toBe("Moderate");
            expect(calculator.getMaturityLevel(60)).toBe("Moderate");
        });
        it("should return 'Weak' for 40-59%", () => {
            expect(calculator.getMaturityLevel(59)).toBe("Weak");
            expect(calculator.getMaturityLevel(50)).toBe("Weak");
            expect(calculator.getMaturityLevel(40)).toBe("Weak");
        });
        it("should return 'Critical' for 0-39%", () => {
            expect(calculator.getMaturityLevel(39)).toBe("Critical");
            expect(calculator.getMaturityLevel(20)).toBe("Critical");
            expect(calculator.getMaturityLevel(0)).toBe("Critical");
        });
    });
    describe("getSummary", () => {
        it("should format summary correctly", () => {
            const results = [
                createResult({ id: "1", priority: 1, status: "pass" }),
                createResult({ id: "2", priority: 1, status: "pass" }),
                createResult({ id: "3", priority: 2, status: "warn" }),
                createResult({ id: "4", priority: 3, status: "fail" }),
            ];
            const score = calculator.calculate(results);
            const summary = calculator.getSummary(score);
            expect(summary).toContain("CA Security Maturity:");
            expect(summary).toContain("%");
            expect(summary).toContain("Priority Breakdown:");
            expect(summary).toContain("Critical Controls (P1):");
            expect(summary).toContain("Attack Surface (P2):");
            expect(summary).toContain("Zero Trust (P3):");
            expect(summary).toContain("Check Status:");
            expect(summary).toContain("✓ Passed:");
            expect(summary).toContain("⚠ Partial:");
            expect(summary).toContain("✗ Failed:");
        });
        it("should include maturity level in summary", () => {
            const results = [
                createResult({ id: "1", priority: 1, status: "pass" }),
                createResult({ id: "2", priority: 2, status: "pass" }),
                createResult({ id: "3", priority: 3, status: "pass" }),
            ];
            const score = calculator.calculate(results);
            const summary = calculator.getSummary(score);
            expect(summary).toContain("(Excellent)");
        });
        it("should show correct check counts", () => {
            const results = [
                createResult({ id: "1", status: "pass" }),
                createResult({ id: "2", status: "pass" }),
                createResult({ id: "3", status: "pass" }),
                createResult({ id: "4", status: "warn" }),
                createResult({ id: "5", status: "fail" }),
                createResult({ id: "6", status: "fail" }),
            ];
            const score = calculator.calculate(results);
            const summary = calculator.getSummary(score);
            expect(summary).toContain("✓ Passed:  3");
            expect(summary).toContain("⚠ Partial: 1");
            expect(summary).toContain("✗ Failed:  2");
        });
        it("should show weighted contributions", () => {
            const results = [
                createResult({ id: "1", priority: 1, status: "pass" }),
                createResult({ id: "2", priority: 2, status: "pass" }),
                createResult({ id: "3", priority: 3, status: "pass" }),
            ];
            const score = calculator.calculate(results);
            const summary = calculator.getSummary(score);
            expect(summary).toContain("(contributes 40 pts)"); // P1
            expect(summary).toContain("(contributes 35 pts)"); // P2
            expect(summary).toContain("(contributes 25 pts)"); // P3
        });
    });
    describe("Real-World Scenarios", () => {
        it("should handle typical tenant with some gaps", () => {
            const results = [
                // P1: 4 pass, 1 warn, 2 fail (71%)
                createResult({ id: "P1-1", priority: 1, status: "pass" }),
                createResult({ id: "P1-2", priority: 1, status: "pass" }),
                createResult({ id: "P1-3", priority: 1, status: "pass" }),
                createResult({ id: "P1-4", priority: 1, status: "pass" }),
                createResult({ id: "P1-5", priority: 1, status: "warn" }),
                createResult({ id: "P1-6", priority: 1, status: "fail" }),
                createResult({ id: "P1-7", priority: 1, status: "fail" }),
                // P2: 3 pass, 1 warn, 1 fail (74%)
                createResult({ id: "P2-1", priority: 2, status: "pass" }),
                createResult({ id: "P2-2", priority: 2, status: "pass" }),
                createResult({ id: "P2-3", priority: 2, status: "pass" }),
                createResult({ id: "P2-4", priority: 2, status: "warn" }),
                createResult({ id: "P2-5", priority: 2, status: "fail" }),
                // P3: 2 pass, 5 fail (29%)
                createResult({ id: "P3-1", priority: 3, status: "pass" }),
                createResult({ id: "P3-2", priority: 3, status: "pass" }),
                createResult({ id: "P3-3", priority: 3, status: "fail" }),
                createResult({ id: "P3-4", priority: 3, status: "fail" }),
                createResult({ id: "P3-5", priority: 3, status: "fail" }),
                createResult({ id: "P3-6", priority: 3, status: "fail" }),
                createResult({ id: "P3-7", priority: 3, status: "fail" }),
            ];
            const score = calculator.calculate(results);
            // P1: (400 + 70 + 0) / 7 = 67
            expect(score.byPriority.priority1).toBe(67);
            // P2: (300 + 70 + 0) / 5 = 74
            expect(score.byPriority.priority2).toBe(74);
            // P3: (200 + 0) / 7 = 29
            expect(score.byPriority.priority3).toBe(29);
            // Overall: (67 * 0.40) + (74 * 0.35) + (29 * 0.25)
            // = 26.8 + 25.9 + 7.25 = 59.95 → 60
            expect(score.overall).toBe(60);
            const summary = calculator.getSummary(score);
            expect(summary).toContain("Moderate");
        });
    });
});
