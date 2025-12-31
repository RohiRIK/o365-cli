import { describe, it, expect } from "bun:test";
import { TaskRegistry } from "../../handlers/registry";
// We will import the handler here to trigger registration once it exists
// import "../../handlers/sec/ca-audit"; 

describe("CA Audit Module", () => {
  it("should be registered in the TaskRegistry", async () => {
    // Dynamic import to simulate runtime loading
    await import("../../handlers/sec/ca-audit");
    
    const handler = TaskRegistry.getHandler("sec:ca-audit");
    expect(handler).toBeDefined();
    expect(handler?.taskId).toBe("sec:ca-audit");
    expect(handler?.name).toBe("Conditional Access Audit");
    expect(handler?.type).toBe("audit");
  });
});
