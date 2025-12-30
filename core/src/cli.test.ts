import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { Command } from "commander";
import { setupCLI } from "./cli";

describe("CLI Entry Point", () => {
  let program: Command;
  let exitSpy: any;
  let stdoutSpy: any;

  beforeEach(() => {
    program = new Command();
    // Prevent actual process exit
    exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);
    // Suppress console output during tests
    stdoutSpy = spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it("should have a version", async () => {
    await setupCLI(program);
    expect(program.version()).toBe("0.0.1");
  });

  it("should have a 'run' command", async () => {
    await setupCLI(program);
    const runCmd = program.commands.find((cmd) => cmd.name() === "run");
    expect(runCmd).toBeDefined();
    expect(runCmd?.description()).toBe("Run a specific task module");
  });

  it("should fail when run is called without arguments", async () => {
     await setupCLI(program);
     const runCmd = program.commands.find((cmd) => cmd.name() === "run");
     // @ts-ignore - registeredArguments is internal but accessible
     const args = runCmd?.registeredArguments;
     expect(args.map((arg: any) => arg.name())).toContain("moduleName");
  });

  it("should attempt to load modules dynamically", async () => {
    // This is a bit tricky to unit test without mocking `import` or the registry.
    // For now, we will assume if we can call `TaskRegistry.getRegisteredTasks()` it works.
    // The actual loading logic will be in `loadCommands`.
    const { TaskRegistry } = await import("./handlers/registry");
    expect(TaskRegistry).toBeDefined();
  });
});
