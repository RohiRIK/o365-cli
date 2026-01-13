import { describe, it, expect, mock } from "bun:test";
import { WorkerRunner } from "./worker-runner";
import { TaskRegistry } from "../handlers/registry";

describe("WorkerRunner", () => {
  it("should execute task in process", async () => {
    const runner = new WorkerRunner();
    
    // Register a mock task
    const mockExecute = mock(() => Promise.resolve());
    TaskRegistry.register({
      taskId: "test:mock",
      execute: mockExecute,
      parseArgs: (args) => ({ dryRun: true }),
      validate: () => ({ valid: true })
    });

    const result = await runner.runTaskInProcess("test:mock", ["--dry-run", "true"]);
    
    expect(result.success).toBe(true);
    expect(mockExecute).toHaveBeenCalled();
  });
});
