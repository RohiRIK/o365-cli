import { describe, it, expect } from "bun:test";
import { CABaselineAnalyzer } from "./ca-baseline";
describe("CA Baseline Analyzer", () => {
    const mockPolicies = [
        {
            displayName: "Block Legacy Auth",
            state: "enabled",
            conditions: {
                clientAppTypes: ["exchangeActiveSync", "other"],
                applications: { includeApplications: ["All"] }
            },
            grantControls: {
                builtInControls: ["block"]
            }
        },
        {
            displayName: "MFA for Admins",
            state: "enabled",
            conditions: {
                applications: { includeApplications: ["MicrosoftAdminPortals"] },
                users: { includeRoles: ["62e90394-69f5-4237-9190-012177145e10"] }
            },
            grantControls: {
                builtInControls: ["mfa"]
            }
        }
    ];
    it("should identify passing best practice checks using technical IDs", () => {
        const analyzer = new CABaselineAnalyzer();
        const results = analyzer.analyze(mockPolicies);
        const legacyAuth = results.find(r => r.id === "CAP001");
        expect(legacyAuth?.status).toBe("pass");
        const mfaAdmins = results.find(r => r.id === "CAU009");
        expect(mfaAdmins?.status).toBe("pass");
    });
    it("should identify 'warn' status for report-only policies", () => {
        const reportOnlyPolicies = [
            {
                displayName: "Report Only MFA",
                state: "enabledReportOnly",
                conditions: {
                    users: { includeUsers: ["All"] },
                    applications: { includeApplications: ["All"] }
                },
                grantControls: { builtInControls: ["mfa"] }
            }
        ];
        const analyzer = new CABaselineAnalyzer();
        const results = analyzer.analyze(reportOnlyPolicies);
        const mfaAll = results.find(r => r.id === "CAU002");
        expect(mfaAll?.status).toBe("warn");
    });
    it("should correctly handle 'All Apps' coverage", () => {
        const allAppsPolicy = [
            {
                displayName: "Universal MFA",
                state: "enabled",
                conditions: {
                    users: { includeUsers: ["All"] },
                    applications: { includeApplications: ["All"] }
                },
                grantControls: { builtInControls: ["mfa"] }
            }
        ];
        const analyzer = new CABaselineAnalyzer();
        const results = analyzer.analyze(allAppsPolicy);
        // CAU009 (Admin Portals) should pass because All Apps covers it
        const mfaAdmins = results.find(r => r.id === "CAU009");
        expect(mfaAdmins?.status).toBe("pass");
    });
    describe("Grant Control OR/AND Logic (Critical Fix)", () => {
        it("should respect OR operator - policy with multiple controls should pass if ANY control matches", () => {
            // Policy has both MFA and device compliance with OR operator
            // This should pass MFA checks even though it also requires device compliance
            const policyWithOrOperator = [
                {
                    displayName: "MFA OR Device",
                    state: "enabled",
                    conditions: {
                        users: { includeUsers: ["All"] },
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: {
                        operator: "OR",
                        builtInControls: ["mfa", "compliantDevice"]
                    }
                }
            ];
            const analyzer = new CABaselineAnalyzer();
            const results = analyzer.analyze(policyWithOrOperator);
            // CAU002 (MFA for All) should PASS - OR means MFA satisfies requirement
            const mfaAll = results.find(r => r.id === "CAU002");
            expect(mfaAll?.status).toBe("pass");
        });
        it("should respect OR operator - block control with other controls should pass block checks", () => {
            // Policy blocks OR requires MFA for high-risk sign-ins
            const policyWithBlockOr = [
                {
                    displayName: "Block or MFA for High Risk",
                    state: "enabled",
                    conditions: {
                        signInRiskLevels: ["high"],
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: {
                        operator: "OR",
                        builtInControls: ["block", "mfa"]
                    }
                }
            ];
            const analyzer = new CABaselineAnalyzer();
            const results = analyzer.analyze(policyWithBlockOr);
            // CAU015 (Block High-Risk Sign-ins) should PASS
            const blockRisk = results.find(r => r.id === "CAU015");
            expect(blockRisk?.status).toBe("pass");
        });
        it("should handle policies with only required control (no operator ambiguity)", () => {
            // Policy with single control (no operator confusion)
            const singleControlPolicy = [
                {
                    displayName: "Simple Block",
                    state: "enabled",
                    conditions: {
                        signInRiskLevels: ["high"],
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: {
                        builtInControls: ["block"]
                    }
                }
            ];
            const analyzer = new CABaselineAnalyzer();
            const results = analyzer.analyze(singleControlPolicy);
            const blockRisk = results.find(r => r.id === "CAU015");
            expect(blockRisk?.status).toBe("pass");
        });
        it("should handle device compliance with multiple acceptable controls", () => {
            // CAD001 accepts EITHER compliantDevice OR domainJoinedDevice
            const hybridJoinedPolicy = [
                {
                    displayName: "Hybrid Joined Only",
                    state: "enabled",
                    conditions: {
                        applications: { includeApplications: ["Office365"] }
                    },
                    grantControls: {
                        builtInControls: ["domainJoinedDevice"]
                    }
                }
            ];
            const analyzer = new CABaselineAnalyzer();
            const results = analyzer.analyze(hybridJoinedPolicy);
            // CAD001 should PASS - domainJoinedDevice satisfies requirement
            const deviceCompliance = results.find(r => r.id === "CAD001");
            expect(deviceCompliance?.status).toBe("pass");
        });
        it("should handle MAM with multiple acceptable controls", () => {
            // CAD002 accepts EITHER compliantApplication OR approvedApplication
            const approvedAppPolicy = [
                {
                    displayName: "Approved Apps for iOS",
                    state: "enabled",
                    conditions: {
                        platforms: { includePlatforms: ["ios"] }
                    },
                    grantControls: {
                        builtInControls: ["approvedApplication"]
                    }
                }
            ];
            const analyzer = new CABaselineAnalyzer();
            const results = analyzer.analyze(approvedAppPolicy);
            // CAD002 should PASS - approvedApplication satisfies requirement
            const mam = results.find(r => r.id === "CAD002");
            expect(mam?.status).toBe("pass");
        });
        it("should fail when policy has wrong controls even with OR operator", () => {
            // Policy requires compliantDevice but check needs block
            const wrongControlPolicy = [
                {
                    displayName: "Wrong Control for Risk",
                    state: "enabled",
                    conditions: {
                        signInRiskLevels: ["high"],
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: {
                        operator: "OR",
                        builtInControls: ["compliantDevice", "mfa"] // No "block"
                    }
                }
            ];
            const analyzer = new CABaselineAnalyzer();
            const results = analyzer.analyze(wrongControlPolicy);
            // CAU015 (Block High-Risk Sign-ins) should FAIL - no block control
            const blockRisk = results.find(r => r.id === "CAU015");
            expect(blockRisk?.status).toBe("fail");
        });
        it("should handle policies with no grant controls", () => {
            const noControlsPolicy = [
                {
                    displayName: "No Controls",
                    state: "enabled",
                    conditions: {
                        signInRiskLevels: ["high"],
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: {} // No builtInControls
                }
            ];
            const analyzer = new CABaselineAnalyzer();
            const results = analyzer.analyze(noControlsPolicy);
            // Should fail checks that require grant controls
            const blockRisk = results.find(r => r.id === "CAU015");
            expect(blockRisk?.status).toBe("fail");
        });
    });
    describe("Policy Evidence Collection (Phase 2)", () => {
        it("should collect matched policies for passing checks", () => {
            const legacyBlockPolicy = [
                {
                    id: "policy-123",
                    displayName: "Block Legacy Auth",
                    state: "enabled",
                    conditions: {
                        clientAppTypes: ["exchangeActiveSync", "other"],
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: {
                        builtInControls: ["block"]
                    }
                }
            ];
            const analyzer = new CABaselineAnalyzer();
            const results = analyzer.analyze(legacyBlockPolicy);
            // CAP001 should pass AND have matched policy evidence
            const legacyAuth = results.find(r => r.id === "CAP001");
            expect(legacyAuth?.status).toBe("pass");
            expect(legacyAuth?.matchedPolicies).toBeDefined();
            expect(legacyAuth?.matchedPolicies?.length).toBe(1);
            expect(legacyAuth?.matchedPolicies?.[0].policyId).toBe("policy-123");
            expect(legacyAuth?.matchedPolicies?.[0].policyName).toBe("Block Legacy Auth");
        });
        it("should include coverage details in matched policies", () => {
            const mfaPolicy = [
                {
                    id: "mfa-001",
                    displayName: "Universal MFA",
                    state: "enabled",
                    conditions: {
                        users: { includeUsers: ["All"] },
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: {
                        builtInControls: ["mfa"]
                    }
                }
            ];
            const analyzer = new CABaselineAnalyzer();
            const results = analyzer.analyze(mfaPolicy);
            const mfaAll = results.find(r => r.id === "CAU002");
            expect(mfaAll?.matchedPolicies?.[0].coverageDetails).toBeDefined();
            expect(mfaAll?.matchedPolicies?.[0].coverageDetails.userScope).toBe("full");
            expect(mfaAll?.matchedPolicies?.[0].coverageDetails.appScope).toBe("full");
            expect(mfaAll?.matchedPolicies?.[0].confidence).toBe("high");
        });
        it("should detect report-only state in matched policies", () => {
            const reportOnlyPolicy = [
                {
                    id: "report-001",
                    displayName: "MFA Report Only",
                    state: "enabledReportOnly",
                    conditions: {
                        users: { includeUsers: ["All"] },
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: {
                        builtInControls: ["mfa"]
                    }
                }
            ];
            const analyzer = new CABaselineAnalyzer();
            const results = analyzer.analyze(reportOnlyPolicy);
            const mfaAll = results.find(r => r.id === "CAU002");
            expect(mfaAll?.status).toBe("warn");
            expect(mfaAll?.matchedPolicies?.[0].coverageScore).toBe(0.7); // Reduced for report-only
            expect(mfaAll?.matchedPolicies?.[0].gaps).toBeDefined();
            expect(mfaAll?.matchedPolicies?.[0].gaps?.[0].type).toBe("state");
            expect(mfaAll?.matchedPolicies?.[0].gaps?.[0].suggestion).toContain("enabled");
        });
        it("should handle multiple policies matching the same check", () => {
            const multiplePolicies = [
                {
                    id: "block-legacy-1",
                    displayName: "Block Legacy - Policy 1",
                    state: "enabled",
                    conditions: {
                        clientAppTypes: ["exchangeActiveSync", "other"],
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: {
                        builtInControls: ["block"]
                    }
                },
                {
                    id: "block-legacy-2",
                    displayName: "Block Legacy - Policy 2",
                    state: "enabledReportOnly",
                    conditions: {
                        clientAppTypes: ["exchangeActiveSync", "other"],
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: {
                        builtInControls: ["block"]
                    }
                }
            ];
            const analyzer = new CABaselineAnalyzer();
            const results = analyzer.analyze(multiplePolicies);
            const legacyAuth = results.find(r => r.id === "CAP001");
            expect(legacyAuth?.matchedPolicies?.length).toBe(2);
            expect(legacyAuth?.matchedPolicies?.[0].policyId).toBe("block-legacy-1");
            expect(legacyAuth?.matchedPolicies?.[1].policyId).toBe("block-legacy-2");
        });
        it("should estimate remediation effort correctly", () => {
            const analyzer = new CABaselineAnalyzer();
            // Passing check - low effort
            const passingPolicy = [
                {
                    displayName: "Test",
                    state: "enabled",
                    conditions: {
                        clientAppTypes: ["exchangeActiveSync", "other"],
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: { builtInControls: ["block"] }
                }
            ];
            const passResults = analyzer.analyze(passingPolicy);
            const pass = passResults.find(r => r.id === "CAP001");
            expect(pass?.remediationEffort).toBe("low");
            // Warning check (report-only) - low effort (just enable)
            const warnPolicy = [
                {
                    displayName: "Test",
                    state: "enabledReportOnly",
                    conditions: {
                        clientAppTypes: ["exchangeActiveSync", "other"],
                        applications: { includeApplications: ["All"] }
                    },
                    grantControls: { builtInControls: ["block"] }
                }
            ];
            const warnResults = analyzer.analyze(warnPolicy);
            const warn = warnResults.find(r => r.id === "CAP001");
            expect(warn?.remediationEffort).toBe("low");
            // Failing check (no policy) - medium effort (create new)
            const failResults = analyzer.analyze([]);
            const fail = failResults.find(r => r.id === "CAP001");
            expect(fail?.remediationEffort).toBe("medium");
        });
    });
});
