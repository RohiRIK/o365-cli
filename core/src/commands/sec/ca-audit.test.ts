import { describe, it, expect, mock, beforeEach } from "bun:test";
import { TaskRegistry } from "../../handlers/registry";
import { GraphService } from "../../services/graph";
import { fetchCAPolicies } from "../../handlers/sec/ca-audit";
import { 
  summarizeAssignments, 
  summarizeConditions, 
  summarizeGrantControls,
  auditCAPolicies 
} from "./ca-audit";

// Mock GraphService
mock.module("../../services/graph", () => {
  return {
    GraphService: {
      fetchAll: mock(() => Promise.resolve([])),
    },
  };
});

describe("CA Audit Module", () => {
  const mockPolicies = [
    { 
      id: "1", 
      displayName: "Policy Enabled", 
      state: "enabled",
      conditions: { users: { includeUsers: ["user-2"] } },
      grantControls: { builtInControls: ["mfa"] }
    },
    { 
      id: "2", 
      displayName: "Policy Disabled", 
      state: "disabled",
      conditions: { users: { includeUsers: ["user-1"] } },
      grantControls: { builtInControls: ["block"] }
    },
  ];

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
      (GraphService.fetchAll as any).mockResolvedValue(mockPolicies);
      const policies = await fetchCAPolicies();
      expect(GraphService.fetchAll).toHaveBeenCalledWith("/identity/conditionalAccess/policies");
      expect(policies).toEqual(mockPolicies);
    });
  });

  describe("Data Normalization", () => {
    it("should summarize user assignments correctly", async () => {
      const users = {
        includeUsers: ["All"],
        excludeUsers: ["user-id-1"],
        includeGroups: ["group-id-1"],
      };
      const summary = await summarizeAssignments(users);
      expect(summary).toContain("Users: [All]");
      expect(summary).toContain("Groups: group-id-1");
      expect(summary).toContain("Exclude: 1");
    });

    it("should summarize conditions correctly", async () => {
      const conditions = {
        platforms: { includePlatforms: ["all"], excludePlatforms: ["android"] },
        clientAppTypes: ["browser", "mobileAppsAndDesktopClients"],
      };
      const summary = await summarizeConditions(conditions);
      expect(summary).toContain("Platforms: All (Exc: android)");
      expect(summary).toContain("Clients: browser, mobile");
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

  describe("Filtering Logic", () => {
    it("should filter by state", async () => {
      (GraphService.fetchAll as any).mockResolvedValue(mockPolicies);
      
      const enabledOnly = await auditCAPolicies({ analyze: false, state: "enabled" });
      expect(enabledOnly).toHaveLength(1);
      expect(enabledOnly[0].displayName).toBe("Policy Enabled");

      const disabledOnly = await auditCAPolicies({ analyze: false, state: "disabled" });
      expect(disabledOnly).toHaveLength(1);
      expect(disabledOnly[0].displayName).toBe("Policy Disabled");
    });

    it("should filter by target user (inclusion check)", async () => {
      (GraphService.fetchAll as any).mockResolvedValue(mockPolicies);
      
      const user1Policies = await auditCAPolicies({ analyze: false, target: "user-1" });
      expect(user1Policies).toHaveLength(1);
      expect(user1Policies[0].displayName).toBe("Policy Disabled");
    });
  });
});
