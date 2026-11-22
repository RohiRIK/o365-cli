import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { generateExecutiveDashboard } from "../../commands/rep/executive-dashboard";

interface ExecutiveDashboardArgs extends TaskArgs {
  dryRun: boolean;
}

class ExecutiveDashboardHandler implements TaskHandler {
  taskId = "rep:executive-dashboard";
  name = "Executive Dashboard";
  description = "High-level overview of tenant health and security";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): ExecutiveDashboardArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
  }

  validate(args: ExecutiveDashboardArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: ExecutiveDashboardArgs): Promise<void> {
    await generateExecutiveDashboard(args.dryRun);
  }
}

TaskRegistry.register(new ExecutiveDashboardHandler());
