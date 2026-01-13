import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag, parseNumberFlag } from "../registry";
import { auditPasswordExpiry } from "../../commands/sec/password-expiry-audit";

interface PasswordExpiryArgs extends TaskArgs {
  days: number;
  dryRun: boolean;
}

class PasswordExpiryHandler implements TaskHandler {
  taskId = "sec:password-expiry-audit";
  name = "Password Expiry Audit";
  description = "Audit password ages and expiry configurations";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): PasswordExpiryArgs {
    return {
      days: parseNumberFlag(rawArgs, "days", 30),
      dryRun: parseBooleanFlag(rawArgs, "dry-run", false)
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
