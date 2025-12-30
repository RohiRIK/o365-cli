import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { generateExecutiveDashboard } from "../../commands/rep/executive-dashboard";

interface ExecutiveDashboardArgs extends TaskArgs {
  dryRun: boolean;
}

class ExecutiveDashboardHandler implements TaskHandler {
  taskId = "rep:executive-dashboard";

  parseArgs(rawArgs: string[]): ExecutiveDashboardArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: ExecutiveDashboardArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: ExecutiveDashboardArgs): Promise<void> {
    await generateExecutiveDashboard(args.dryRun);
  }
}

TaskRegistry.register(new ExecutiveDashboardHandler());
