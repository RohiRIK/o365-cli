import { describe, it, expect, mock, beforeEach } from "bun:test";
import { TaskRegistry } from "../../handlers/registry";
import { GraphService } from "../../services/graph";
import { fetchCAPolicies } from "../../handlers/sec/ca-audit";
import { summarizeAssignments, summarizeConditions, summarizeGrantControls } from "./ca-audit";

// Mock GraphService
mock.module("../../services/graph", () => {
  return {
    GraphService: {
      fetchAll: mock(() => Promise.resolve([])),
    },
  };
});

describe("CA Audit Module", () => {
  beforeEach(() => {
    (GraphService.fetchAll as any).mockClear();
  });

  describe("Registration & Fetching", () => {
    it("should be registered in the TaskRegistry", async () => {
      await import("../../handlers/sec/ca-audit");
      const handler = TaskRegistry.getHandler("sec:ca-audit");
      expect(handler).toBeDefined();
      expect(handler?.taskId).toBe("sec:ca-audit");
    });

    it("should fetch CA policies from Graph API", async () => {
      const mockPolicies = [
        { id: "1", displayName: "Policy 1", state: "enabled" },
      ];
      (GraphService.fetchAll as any).mockResolvedValue(mockPolicies);
      const policies = await fetchCAPolicies();
      expect(GraphService.fetchAll).toHaveBeenCalledWith("/identity/conditionalAccess/policies");
      expect(policies).toEqual(mockPolicies);
    });
  });

  describe("Data Normalization", () => {
    it("should summarize user assignments correctly", () => {
      const users = {
        includeUsers: ["All"],
        excludeUsers: ["user-id-1"],
        includeGroups: ["group-id-1"],
      };
      const summary = summarizeAssignments(users);
      expect(summary).toContain("Users: [All]");
      expect(summary).toContain("Groups: 1");
      expect(summary).toContain("Exclude: 1");
    });

    it("should summarize conditions correctly", () => {
      const conditions = {
        platforms: { includePlatforms: ["all"], excludePlatforms: ["android"] },
        clientAppTypes: ["browser", "mobileAppsAndDesktopClients"],
      };
      const summary = summarizeConditions(conditions);
      expect(summary).toContain("Platforms: All (Exc: android)");
      expect(summary).toContain("Apps: browser, mobile");
    });

    it("should summarize grant controls correctly", () => {
      const controls = {
        operator: "OR",
        builtInControls: ["mfa", "compliantDevice"],
      };
      const summary = summarizeGrantControls(controls);
      expect(summary).toBe("mfa OR compliantDevice");
    });
  });
});
