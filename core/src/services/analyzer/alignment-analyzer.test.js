/**
 * AlignmentAnalyzer Unit Tests
 *
 * Tests for per-policy alignment analysis including:
 * - Exclusion impact calculation
 * - Alignment status determination
 * - Gap generation
 * - Compensating control suggestions
 */
import { describe, it, expect } from "bun:test";
import { AlignmentAnalyzer } from "./alignment-analyzer";
describe("AlignmentAnalyzer", () => {
    const analyzer = new AlignmentAnalyzer();
    // Helper to create minimal Policy object
    const createPolicy = (overrides = {}) => {
        return {
            id: "test-policy-id",
            displayName: "Test Policy",
            state: "enabled",
            conditions: {
                users: {
                    includeUsers: ["All"],
                },
                applications: {
                    includeApplications: ["All"],
                },
            },
            grantControls: {
                builtInControls: ["mfa"],
                operator: "OR",
            },
            ...overrides,
        };
    };
    // Helper to create minimal PolicyMatch object
    const createPolicyMatch = (overrides = {}) => {
        return {
            policyId: "test-policy-id",
            policyName: "Test Policy",
            state: "enabled",
            coverageScore: 1.0,
            coverageDetails: {
                userScope: "full",
                appScope: "full",
                controlMatch: "exact",
            },
            confidence: "high",
            ...overrides,
        };
    };
    describe("analyzeMatch", () => {
        it("should enhance PolicyMatch with alignment fields", () => {
            const policy = createPolicy();
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.alignmentStatus).toBeDefined();
            expect(enhanced.alignmentScore).toBeDefined();
            expect(enhanced.alignmentStatus).toBe("Aligned");
            expect(enhanced.alignmentScore).toBeGreaterThanOrEqual(85);
        });
        it("should preserve original PolicyMatch fields", () => {
            const policy = createPolicy();
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.policyId).toBe(match.policyId);
            expect(enhanced.policyName).toBe(match.policyName);
            expect(enhanced.state).toBe(match.state);
            expect(enhanced.coverageScore).toBe(match.coverageScore);
        });
    });
    describe("Alignment Status Determination", () => {
        it("should return 'Aligned' for perfect policy (score >= 85)", () => {
            const policy = createPolicy();
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.alignmentStatus).toBe("Aligned");
            expect(enhanced.alignmentScore).toBe(100);
        });
        it("should return 'Not Aligned' for disabled policy (score = 0)", () => {
            const policy = createPolicy({ state: "disabled" });
            const match = createPolicyMatch({ state: "disabled" });
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.alignmentStatus).toBe("Not Aligned");
            expect(enhanced.alignmentScore).toBe(0);
        });
        it("should return 'Partially Aligned' for report-only policy (score = 70)", () => {
            const policy = createPolicy({ state: "enabledReportOnly" });
            const match = createPolicyMatch({ state: "enabledReportOnly" });
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.alignmentStatus).toBe("Partially Aligned");
            expect(enhanced.alignmentScore).toBe(70); // 100 - 30 (report-only penalty)
        });
        it("should apply -30 point penalty for report-only", () => {
            const policy = createPolicy({ state: "enabledReportOnly" });
            const match = createPolicyMatch({ state: "enabledReportOnly" });
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.alignmentScore).toBe(70);
        });
        it("should apply -20 point penalty for partial user scope", () => {
            const policy = createPolicy();
            const match = createPolicyMatch({
                coverageDetails: {
                    userScope: "partial",
                    appScope: "full",
                    controlMatch: "exact",
                },
            });
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.alignmentScore).toBe(80); // 100 - 20
            expect(enhanced.alignmentStatus).toBe("Partially Aligned");
        });
        it("should apply -10 point penalty for partial app scope", () => {
            const policy = createPolicy();
            const match = createPolicyMatch({
                coverageDetails: {
                    userScope: "full",
                    appScope: "partial",
                    controlMatch: "exact",
                },
            });
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.alignmentScore).toBe(90); // 100 - 10
            expect(enhanced.alignmentStatus).toBe("Aligned");
        });
        it("should apply -15 point penalty for weaker controls", () => {
            const policy = createPolicy();
            const match = createPolicyMatch({
                coverageDetails: {
                    userScope: "full",
                    appScope: "full",
                    controlMatch: "weaker",
                },
            });
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.alignmentScore).toBe(85); // 100 - 15
            expect(enhanced.alignmentStatus).toBe("Aligned");
        });
        it("should correctly apply multiple penalties", () => {
            const policy = createPolicy({ state: "enabledReportOnly" });
            const match = createPolicyMatch({
                state: "enabledReportOnly",
                coverageDetails: {
                    userScope: "partial",
                    appScope: "partial",
                    controlMatch: "exact",
                },
            });
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            // 100 - 30 (report-only) - 20 (partial user) - 10 (partial app) = 40
            expect(enhanced.alignmentScore).toBe(40);
            expect(enhanced.alignmentStatus).toBe("Not Aligned");
        });
    });
    describe("Exclusion Impact Calculation", () => {
        it("should calculate 0% impact for policies with no exclusions", () => {
            const policy = createPolicy();
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact).toBeUndefined(); // No impact = no object
        });
        it("should estimate 1% impact per excluded user", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                        excludeUsers: ["user1", "user2", "user3"], // 3 users
                    },
                    applications: {
                        includeApplications: ["All"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.percentage).toBe(3); // 3 * 1%
        });
        it("should estimate 15% impact per excluded group", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                        excludeGroups: ["group1", "group2"], // 2 groups
                    },
                    applications: {
                        includeApplications: ["All"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.percentage).toBe(30); // 2 * 15%
        });
        it("should estimate 5% impact per excluded role", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                        excludeRoles: ["role1"], // 1 role
                    },
                    applications: {
                        includeApplications: ["All"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.percentage).toBe(5); // 1 * 5%
        });
        it("should estimate 5% impact per excluded app", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                    },
                    applications: {
                        includeApplications: ["All"],
                        excludeApplications: ["app1", "app2"], // 2 apps
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.percentage).toBe(10); // 2 * 5%
        });
        it("should aggregate multiple exclusion types", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                        excludeUsers: ["user1"], // 1%
                        excludeGroups: ["group1"], // 15%
                        excludeRoles: ["role1"], // 5%
                    },
                    applications: {
                        includeApplications: ["All"],
                        excludeApplications: ["app1"], // 5%
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.percentage).toBe(26); // 1 + 15 + 5 + 5
        });
        it("should cap exclusion impact at 100%", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                        excludeGroups: new Array(20).fill("group"), // 20 * 15% = 300%
                    },
                    applications: {
                        includeApplications: ["All"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.percentage).toBe(100); // Capped at 100%
        });
        it("should apply -5 point penalty for 1-10% exclusions", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                        excludeUsers: ["user1", "user2"], // 2%
                    },
                    applications: {
                        includeApplications: ["All"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.alignmentScore).toBe(95); // 100 - 5
        });
        it("should apply -20 point penalty for 10-30% exclusions", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                        excludeGroups: ["group1"], // 15%
                    },
                    applications: {
                        includeApplications: ["All"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.alignmentScore).toBe(80); // 100 - 20
        });
        it("should apply -40 point penalty for >30% exclusions", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                        excludeGroups: ["group1", "group2", "group3"], // 45%
                    },
                    applications: {
                        includeApplications: ["All"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.alignmentScore).toBe(60); // 100 - 40
        });
    });
    describe("High-Risk Exclusion Detection", () => {
        it("should flag Office365 app exclusion as high-risk", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                    },
                    applications: {
                        includeApplications: ["All"],
                        excludeApplications: ["Office365"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.highRisk).toBe(true);
        });
        it("should flag MicrosoftAdminPortals exclusion as high-risk", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                    },
                    applications: {
                        includeApplications: ["All"],
                        excludeApplications: ["MicrosoftAdminPortals"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.highRisk).toBe(true);
        });
        it("should not flag non-critical app exclusions as high-risk", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                    },
                    applications: {
                        includeApplications: ["All"],
                        excludeApplications: ["some-random-app"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.highRisk).toBe(false);
        });
    });
    describe("Compensating Controls Suggestions", () => {
        it("should suggest network restrictions for excluded users", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                        excludeUsers: ["user1"],
                    },
                    applications: {
                        includeApplications: ["All"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.compensatingControls).toContain("Implement network location restrictions for excluded users");
            expect(enhanced.exclusionImpact?.compensatingControls).toContain("Require device compliance for excluded accounts");
        });
        it("should suggest dedicated policy for excluded apps", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                    },
                    applications: {
                        includeApplications: ["All"],
                        excludeApplications: ["app1"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.compensatingControls).toContain("Create dedicated policy for excluded applications");
        });
        it("should suggest stronger controls for excluded roles", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                        excludeRoles: ["role1"],
                    },
                    applications: {
                        includeApplications: ["All"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            expect(enhanced.exclusionImpact?.compensatingControls).toContain("Implement stronger controls for excluded roles");
        });
    });
    describe("Gap Generation", () => {
        it("should add exclusion gap when exclusions present", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                        excludeUsers: ["user1"],
                    },
                    applications: {
                        includeApplications: ["All"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            const exclusionGap = enhanced.gaps?.find((g) => g.type === "exclusions");
            expect(exclusionGap).toBeDefined();
            expect(exclusionGap?.severity).toBe("warning");
            expect(exclusionGap?.message).toContain("Policy excludes 1% of scope");
        });
        it("should add blocker-level gap for high-risk exclusions", () => {
            const policy = createPolicy({
                conditions: {
                    users: {
                        includeUsers: ["All"],
                    },
                    applications: {
                        includeApplications: ["All"],
                        excludeApplications: ["Office365"],
                    },
                },
            });
            const match = createPolicyMatch();
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            const exclusionGap = enhanced.gaps?.find((g) => g.type === "exclusions");
            expect(exclusionGap?.severity).toBe("blocker");
            expect(exclusionGap?.message).toContain("(includes critical apps/users)");
        });
        it("should add scope gap for partial user scope", () => {
            const policy = createPolicy();
            const match = createPolicyMatch({
                coverageDetails: {
                    userScope: "partial",
                    appScope: "full",
                    controlMatch: "exact",
                },
            });
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            const scopeGap = enhanced.gaps?.find((g) => g.type === "scope" && g.message.includes("partial user scope"));
            expect(scopeGap).toBeDefined();
            expect(scopeGap?.severity).toBe("warning");
            expect(scopeGap?.suggestion).toContain("Expand user scope");
        });
        it("should add control gap for weaker controls", () => {
            const policy = createPolicy();
            const match = createPolicyMatch({
                coverageDetails: {
                    userScope: "full",
                    appScope: "full",
                    controlMatch: "weaker",
                },
            });
            const enhanced = analyzer.analyzeMatch(match, policy, "CAU002");
            const controlGap = enhanced.gaps?.find((g) => g.type === "control");
            expect(controlGap).toBeDefined();
            expect(controlGap?.message).toContain("weaker controls");
            expect(controlGap?.suggestion).toContain("Upgrade to stronger controls");
        });
    });
});
