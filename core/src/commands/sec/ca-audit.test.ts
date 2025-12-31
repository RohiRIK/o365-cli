import { describe, it, expect, mock, beforeEach } from "bun:test";
import { TaskRegistry } from "../../handlers/registry";
import { GraphService } from "../../services/graph";
import { fetchCAPolicies } from "../../handlers/sec/ca-audit";

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
    // Reset mocks
    (GraphService.fetchAll as any).mockClear();
  });

  it("should be registered in the TaskRegistry", async () => {
    await import("../../handlers/sec/ca-audit");
    const handler = TaskRegistry.getHandler("sec:ca-audit");
    expect(handler).toBeDefined();
    expect(handler?.taskId).toBe("sec:ca-audit");
  });

  it("should fetch CA policies from Graph API", async () => {
    const mockPolicies = [
      { id: "1", displayName: "Policy 1", state: "enabled" },
      { id: "2", displayName: "Policy 2", state: "disabled" },
    ];
    (GraphService.fetchAll as any).mockResolvedValue(mockPolicies);

    const policies = await fetchCAPolicies();

    expect(GraphService.fetchAll).toHaveBeenCalledWith("/identity/conditionalAccess/policies");
    expect(policies).toEqual(mockPolicies);
  });
});
