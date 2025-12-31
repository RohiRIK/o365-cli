import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag, parseNumberFlag } from "../registry";
import { analyzeTeamsUsage } from "../../commands/res/teams-usage";

interface TeamsUsageArgs extends TaskArgs {
  days: number;
  dryRun: boolean;
}

class TeamsUsageHandler implements TaskHandler {
  taskId = "res:teams-usage";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): TeamsUsageArgs {
    return {
      days: parseNumberFlag(rawArgs, "days", 90),
      dryRun: parseBooleanFlag(rawArgs, "dry-run", false)
    };
  }

  validate(args: TeamsUsageArgs): ValidationResult {
    if (args.days < 7 || args.days > 365) {
      return {
        valid: false,
        error: `Invalid time range: ${args.days} days. Must be between 7 and 365 days.`,
      };
    }
    return { valid: true };
  }

  async execute(args: TeamsUsageArgs): Promise<void> {
    await analyzeTeamsUsage(args.days, args.dryRun);
  }
}

TaskRegistry.register(new TeamsUsageHandler());
