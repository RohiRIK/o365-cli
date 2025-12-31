import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseNumberFlag,
} from "../registry";
import { detectStaleAccounts } from "../../commands/iam/stale-accounts";

interface StaleAccountsArgs extends TaskArgs {
  days: number;
  dryRun: boolean;
}

class StaleAccountsHandler implements TaskHandler {
  taskId = "iam:stale-accounts";
  type = "action" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): StaleAccountsArgs {
    const days = parseNumberFlag(rawArgs, "days", 180);
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);
    return { days, dryRun };
  }

  validate(args: StaleAccountsArgs): ValidationResult {
    if (args.days < 30 || args.days > 730) {
      return {
        valid: false,
        error: `Invalid inactivity threshold: ${args.days} days. Must be between 30 and 730 days.`,
      };
    }
    return { valid: true };
  }

  async execute(args: StaleAccountsArgs): Promise<void> {
    await detectStaleAccounts(args.days, args.dryRun);
  }
}

TaskRegistry.register(new StaleAccountsHandler());
