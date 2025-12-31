import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag, parseNumberFlag } from "../registry";
import { detectInactiveGroups } from "../../commands/res/inactive-groups";

interface InactiveGroupsArgs extends TaskArgs {
  days: number;
  dryRun: boolean;
}

class InactiveGroupsHandler implements TaskHandler {
  taskId = "res:inactive-groups";
  type = "action" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): InactiveGroupsArgs {
    return {
      days: parseNumberFlag(rawArgs, "days", 90),
      dryRun: parseBooleanFlag(rawArgs, "dry-run", true)
    };
  }

  validate(args: InactiveGroupsArgs): ValidationResult {
    if (args.days < 30 || args.days > 365) {
      return {
        valid: false,
        error: `Invalid inactivity threshold: ${args.days} days. Must be between 30 and 365 days.`,
      };
    }
    return { valid: true };
  }

  async execute(args: InactiveGroupsArgs): Promise<void> {
    await detectInactiveGroups(args.days, args.dryRun);
  }
}

TaskRegistry.register(new InactiveGroupsHandler());
