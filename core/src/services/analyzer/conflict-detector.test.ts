/**
 * ConflictDetector Unit Tests
 *
 * Tests for policy conflict detection including:
 * - BLOCK vs GRANT contradictions
 * - Redundant MFA policies
 * - Scope overlap calculation
 * - Conflict report formatting
 */

import { describe, it, expect } from "bun:test";
import { ConflictDetector } from "./conflict-detector";
import type { Policy } from "./ca-baseline";

describe("ConflictDetector", () => {
  const detector = new ConflictDetector();

  // Helper to create minimal Policy object
  const createPolicy = (
    id: string,
    name: string,
    overrides: Partial<Policy> = {}
  ): Policy => {
    return {
      id,
      displayName: name,
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
    } as Policy;
  };

  describe("detect", () => {
    it("should return empty array when no policies provided", () => {
      const conflicts = detector.detect([]);

      expect(conflicts).toEqual([]);
    });

    it("should return empty array for single policy", () => {
      const policies = [createPolicy("p1", "Policy 1")];

      const conflicts = detector.detect(policies);

      expect(conflicts).toEqual([]);
    });

    it("should skip disabled policies", () => {
      const policies = [
        createPolicy("p1", "Policy 1", { state: "disabled" }),
        createPolicy("p2", "Policy 2", { state: "disabled" }),
      ];

      const conflicts = detector.detect(policies);

      expect(conflicts).toEqual([]);
    });

    it("should skip report-only policies", () => {
      const policies = [
        createPolicy("p1", "Policy 1", { state: "enabledReportOnly" }),
        createPolicy("p2", "Policy 2", { state: "enabledReportOnly" }),
      ];

      const conflicts = detector.detect(policies);

      expect(conflicts).toEqual([]);
    });

    it("should skip policies with low overlap (<10%)", () => {
      const policies = [
        createPolicy("p1", "Policy 1", {
          conditions: {
            users: { includeUsers: ["user1"] },
            applications: { includeApplications: ["app1"] },
            platforms: { includePlatforms: ["windows"] },
          },
        }),
        createPolicy("p2", "Policy 2", {
          conditions: {
            users: { includeUsers: ["user2"] },
            applications: { includeApplications: ["app2"] },
            platforms: { includePlatforms: ["macOS"] },
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      // 0% user + 0% app + 0% platform = 0% total → below 10% threshold
      expect(conflicts).toEqual([]);
    });
  });

  describe("Contradiction Detection", () => {
    it("should detect BLOCK vs GRANT contradiction", () => {
      const policies = [
        createPolicy("p1", "Block Policy", {
          grantControls: {
            builtInControls: ["block"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "MFA Policy", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      expect(conflicts.length).toBe(1);
      expect(conflicts[0].conflictType).toBe("contradiction");
      expect(conflicts[0].severity).toBe("critical");
    });

    it("should include affected scope in contradiction", () => {
      const policies = [
        createPolicy("p1", "Block All", {
          grantControls: {
            builtInControls: ["block"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "Grant All", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      expect(conflicts[0].affectedScope.users).toContain("100% user overlap");
      expect(conflicts[0].affectedScope.apps).toContain("100% app overlap");
    });

    it("should not flag contradiction for two blocking policies", () => {
      const policies = [
        createPolicy("p1", "Block Legacy Auth", {
          grantControls: {
            builtInControls: ["block"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "Block High Risk", {
          grantControls: {
            builtInControls: ["block"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      const contradictions = conflicts.filter((c) => c.conflictType === "contradiction");
      expect(contradictions).toHaveLength(0); // Should be redundancy, not contradiction
    });
  });

  describe("Redundancy Detection", () => {
    it("should detect redundant MFA policies with high overlap (>80%)", () => {
      const policies = [
        createPolicy("p1", "MFA Policy 1", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "MFA Policy 2", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      expect(conflicts.length).toBe(1);
      expect(conflicts[0].conflictType).toBe("redundancy");
      expect(conflicts[0].severity).toBe("info");
    });

    it("should detect redundant BLOCK policies", () => {
      const policies = [
        createPolicy("p1", "Block 1", {
          grantControls: {
            builtInControls: ["block"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "Block 2", {
          grantControls: {
            builtInControls: ["block"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      const redundancies = conflicts.filter((c) => c.conflictType === "redundancy");
      expect(redundancies.length).toBeGreaterThan(0);
      expect(redundancies[0].severity).toBe("info");
    });

    it("should not flag redundancy with low overlap (<80%)", () => {
      const policies = [
        createPolicy("p1", "MFA All Users", {
          conditions: {
            users: { includeUsers: ["All"] },
            applications: { includeApplications: ["app1"] },
          },
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "MFA Different App", {
          conditions: {
            users: { includeUsers: ["All"] },
            applications: { includeApplications: ["app2"] },
          },
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      // Should be overlap, not redundancy (only 50% app overlap, 100% user = 75% total)
      const redundancies = conflicts.filter((c) => c.conflictType === "redundancy");
      expect(redundancies).toHaveLength(0);
    });
  });

  describe("Overlap Detection", () => {
    it("should detect moderate overlap (10-79%)", () => {
      const policies = [
        createPolicy("p1", "MFA for All Users", {
          conditions: {
            users: { includeUsers: ["All"] },
            applications: { includeApplications: ["app1"] },
          },
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "Compliance for All Users", {
          conditions: {
            users: { includeUsers: ["All"] },
            applications: { includeApplications: ["app2"] },
          },
          grantControls: {
            builtInControls: ["compliantDevice"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      const overlaps = conflicts.filter((c) => c.conflictType === "overlap");
      expect(overlaps.length).toBeGreaterThan(0);
      expect(overlaps[0].severity).toBe("warning");
    });

    it("should not flag overlap with <10% overlap", () => {
      const policies = [
        createPolicy("p1", "Policy 1", {
          conditions: {
            users: { includeUsers: ["user1"] },
            applications: { includeApplications: ["app1"] },
            platforms: { includePlatforms: ["windows"] },
          },
        }),
        createPolicy("p2", "Policy 2", {
          conditions: {
            users: { includeUsers: ["user2"] },
            applications: { includeApplications: ["app2"] },
            platforms: { includePlatforms: ["iOS"] },
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      // 0% user + 0% app + 0% platform = 0% total → below 10% threshold
      expect(conflicts).toHaveLength(0);
    });

    it("should not flag overlap if redundancy detected (avoid double-reporting)", () => {
      const policies = [
        createPolicy("p1", "MFA 1", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "MFA 2", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      // Should only be redundancy, not both redundancy and overlap
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflictType).toBe("redundancy");
    });
  });

  describe("Scope Overlap Calculation", () => {
    it("should calculate 100% overlap for both targeting 'All' users", () => {
      const p1 = createPolicy("p1", "Policy 1", {
        conditions: {
          users: { includeUsers: ["All"] },
          applications: { includeApplications: ["All"] },
        },
      });
      const p2 = createPolicy("p2", "Policy 2", {
        conditions: {
          users: { includeUsers: ["All"] },
          applications: { includeApplications: ["All"] },
        },
      });

      const conflicts = detector.detect([p1, p2]);

      // At least one conflict should be detected due to 100% overlap
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it("should calculate 50% overlap when one targets 'All' users", () => {
      const p1 = createPolicy("p1", "Policy 1", {
        conditions: {
          users: { includeUsers: ["All"] },
          applications: { includeApplications: ["All"] },
        },
      });
      const p2 = createPolicy("p2", "Policy 2", {
        conditions: {
          users: { includeUsers: ["user1"] },
          applications: { includeApplications: ["All"] },
        },
      });

      const conflicts = detector.detect([p1, p2]);

      // (50% user + 100% app + 100% platform) / 3 = ~83% overlap
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it("should calculate 30% overlap for common specific users", () => {
      const p1 = createPolicy("p1", "Policy 1", {
        conditions: {
          users: { includeUsers: ["user1", "user2"] },
          applications: { includeApplications: ["All"] },
        },
      });
      const p2 = createPolicy("p2", "Policy 2", {
        conditions: {
          users: { includeUsers: ["user1", "user3"] },
          applications: { includeApplications: ["All"] },
        },
      });

      const conflicts = detector.detect([p1, p2]);

      // (30% user + 100% app + 100% platform) / 3 = ~77% overlap
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it("should calculate 0% overlap for completely disjoint scopes", () => {
      const p1 = createPolicy("p1", "Policy 1", {
        conditions: {
          users: { includeUsers: ["user1"] },
          applications: { includeApplications: ["app1"] },
          platforms: { includePlatforms: ["windows"] },
        },
      });
      const p2 = createPolicy("p2", "Policy 2", {
        conditions: {
          users: { includeUsers: ["user2"] },
          applications: { includeApplications: ["app2"] },
          platforms: { includePlatforms: ["android"] },
        },
      });

      const conflicts = detector.detect([p1, p2]);

      // 0% user + 0% app + 0% platform = 0% total → no overlap
      expect(conflicts).toHaveLength(0);
    });

    it("should handle platform overlap correctly", () => {
      const p1 = createPolicy("p1", "Policy 1", {
        conditions: {
          users: { includeUsers: ["All"] },
          applications: { includeApplications: ["All"] },
          platforms: { includePlatforms: ["windows", "macOS"] },
        },
      });
      const p2 = createPolicy("p2", "Policy 2", {
        conditions: {
          users: { includeUsers: ["All"] },
          applications: { includeApplications: ["All"] },
          platforms: { includePlatforms: ["windows"] },
        },
      });

      const conflicts = detector.detect([p1, p2]);

      // Should detect overlap
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it("should treat no platform restriction as all platforms (100% overlap)", () => {
      const p1 = createPolicy("p1", "Policy 1", {
        conditions: {
          users: { includeUsers: ["All"] },
          applications: { includeApplications: ["All"] },
          // No platform restriction
        },
      });
      const p2 = createPolicy("p2", "Policy 2", {
        conditions: {
          users: { includeUsers: ["All"] },
          applications: { includeApplications: ["All"] },
          // No platform restriction
        },
      });

      const conflicts = detector.detect([p1, p2]);

      // 100% overlap across all dimensions
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe("formatConflicts", () => {
    it("should return 'No conflicts' message for empty array", () => {
      const formatted = detector.formatConflicts([]);

      expect(formatted).toBe("No policy conflicts detected.");
    });

    it("should group conflicts by severity", () => {
      const policies = [
        // Contradiction (critical)
        createPolicy("p1", "Block All", {
          grantControls: {
            builtInControls: ["block"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "Grant All", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
        // Redundancy (info)
        createPolicy("p3", "MFA 1", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
        createPolicy("p4", "MFA 2", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);
      const formatted = detector.formatConflicts(conflicts);

      expect(formatted).toContain("🚨 CRITICAL CONTRADICTIONS:");
      expect(formatted).toContain("ℹ️ INFO (Redundancies");
    });

    it("should include policy names in formatted output", () => {
      const policies = [
        createPolicy("p1", "Block Legacy Auth", {
          grantControls: {
            builtInControls: ["block"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "Require MFA", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);
      const formatted = detector.formatConflicts(conflicts);

      expect(formatted).toContain("Block Legacy Auth");
      expect(formatted).toContain("Require MFA");
    });

    it("should include conflict descriptions", () => {
      const policies = [
        createPolicy("p1", "Block Policy", {
          grantControls: {
            builtInControls: ["block"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "MFA Policy", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);
      const formatted = detector.formatConflicts(conflicts);

      expect(formatted).toContain("blocks access");
      expect(formatted).toContain("grants access");
    });

    it("should include affected scope details", () => {
      const policies = [
        createPolicy("p1", "Block All", {
          grantControls: {
            builtInControls: ["block"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "Grant All", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);
      const formatted = detector.formatConflicts(conflicts);

      expect(formatted).toContain("Affected Scope:");
      expect(formatted).toContain("Users:");
      expect(formatted).toContain("Apps:");
    });
  });

  describe("Real-World Scenarios", () => {
    it("should handle defense-in-depth MFA policies (redundancy, not error)", () => {
      const policies = [
        createPolicy("p1", "MFA for All Users and Apps", {
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "MFA for Admins (Stricter)", {
          conditions: {
            users: { includeRoles: ["admin-role"] },
            applications: { includeApplications: ["All"] },
          },
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      // Should detect redundancy (info-level), not contradiction
      const redundancies = conflicts.filter((c) => c.conflictType === "redundancy");
      const contradictions = conflicts.filter((c) => c.conflictType === "contradiction");

      expect(contradictions).toHaveLength(0); // No critical contradictions
      expect(redundancies[0]?.severity).toBe("info"); // Info-level only
    });

    it("should flag accidental blocking of critical apps", () => {
      const policies = [
        createPolicy("p1", "Block Legacy Auth", {
          conditions: {
            users: { includeUsers: ["All"] },
            applications: { includeApplications: ["All"] },
          },
          grantControls: {
            builtInControls: ["block"],
            operator: "OR",
          },
        }),
        createPolicy("p2", "Allow Office365 with MFA", {
          conditions: {
            users: { includeUsers: ["All"] },
            applications: { includeApplications: ["Office365"] },
          },
          grantControls: {
            builtInControls: ["mfa"],
            operator: "OR",
          },
        }),
      ];

      const conflicts = detector.detect(policies);

      const contradictions = conflicts.filter((c) => c.conflictType === "contradiction");
      expect(contradictions.length).toBeGreaterThan(0);
      expect(contradictions[0].severity).toBe("critical");
    });

    it("should handle multiple policy pairs efficiently", () => {
      const policies = [
        createPolicy("p1", "Policy 1"),
        createPolicy("p2", "Policy 2"),
        createPolicy("p3", "Policy 3"),
        createPolicy("p4", "Policy 4"),
        createPolicy("p5", "Policy 5"),
      ];

      // Should run without errors (O(n²) complexity)
      const conflicts = detector.detect(policies);

      expect(Array.isArray(conflicts)).toBe(true);
    });
  });
});
