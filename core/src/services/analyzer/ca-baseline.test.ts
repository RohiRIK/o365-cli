import { describe, it, expect } from "bun:test";
import { CABaselineAnalyzer } from "./ca-baseline";

describe("CA Baseline Analyzer", () => {
  const mockPolicies = [
    {
      displayName: "Block Legacy Auth",
      state: "enabled",
      conditions: {
        clientAppTypes: ["exchangeActiveSync", "other"]
      },
      grantControls: {
        builtInControls: ["block"]
      }
    },
    {
      displayName: "MFA for Admins",
      state: "enabled",
      conditions: {
        users: { includeRoles: ["62e90394-69f5-4237-9190-012177145e10"] }
      },
      grantControls: {
        builtInControls: ["mfa"]
      }
    }
  ];

  it("should identify passing best practice checks", () => {
    const analyzer = new CABaselineAnalyzer();
    const results = analyzer.analyze(mockPolicies);
    
    const legacyAuth = results.find(r => r.id === "block-legacy-auth");
    expect(legacyAuth?.status).toBe("pass");
    
    const mfaAdmins = results.find(r => r.id === "mfa-admins");
    expect(mfaAdmins?.status).toBe("pass");
  });

  it("should identify missing best practice checks", () => {
    const analyzer = new CABaselineAnalyzer();
    const results = analyzer.analyze([]); // No policies
    
    results.forEach(r => {
      expect(r.status).toBe("fail");
    });
  });
});
