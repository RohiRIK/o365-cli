import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag, parseNumberFlag } from "../registry";
import { auditPasswordExpiry } from "../../commands/sec/password-expiry-audit";

interface PasswordExpiryArgs extends TaskArgs {
  days: number;
  dryRun: boolean;
}

class PasswordExpiryHandler implements TaskHandler {
  taskId = "sec:password-expiry-audit";

  parseArgs(rawArgs: string[]): PasswordExpiryArgs {
    return {
      days: parseNumberFlag(rawArgs, "days", 30),
      dryRun: parseBooleanFlag(rawArgs, "dry-run", true)
    };
  }

  validate(args: PasswordExpiryArgs): ValidationResult {
    if (args.days < 1 || args.days > 365) {
      return {
        valid: false,
        error: `Invalid time range: ${args.days} days. Must be between 1 and 365 days.`,
      };
    }
    return { valid: true };
  }

  async execute(args: PasswordExpiryArgs): Promise<void> {
    await auditPasswordExpiry(args.days, args.dryRun);
  }
}

TaskRegistry.register(new PasswordExpiryHandler());
