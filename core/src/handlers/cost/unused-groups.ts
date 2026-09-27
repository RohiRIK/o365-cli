import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseNumberFlag,
} from "../registry";
import { cleanupUnusedGroups } from "../../commands/cost/unused-groups";

interface UnusedGroupsArgs extends TaskArgs {
  days: number;
  dryRun: boolean;
}

class UnusedGroupsHandler implements TaskHandler {
  taskId = "cost:unused-groups";
  name = "Unused Groups Cleanup";
  description = "Identify and remove orphaned or empty groups";
  type = "action" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): UnusedGroupsArgs {
    const days = parseNumberFlag(rawArgs, "days", 90) || 90;
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);

    return { days, dryRun };
  }

  validate(args: UnusedGroupsArgs): ValidationResult {
    if (args.days < 90 || args.days > 365) {
      return {
        valid: false,
        error: `Invalid inactivity threshold: ${args.days} days. Must be between 90 and 365 days.`,
      };
    }
    return { valid: true };
  }

  async execute(args: UnusedGroupsArgs): Promise<void> {
    await cleanupUnusedGroups(args.days, args.dryRun);
  }
}

TaskRegistry.register(new UnusedGroupsHandler());
