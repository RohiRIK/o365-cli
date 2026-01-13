import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseNumberFlag,
} from "../registry";
import { cleanupGuests } from "../../commands/iam/guest-cleanup";

/**
 * Arguments for guest cleanup task
 */
interface GuestCleanupArgs extends TaskArgs {
  days: number;
  dryRun: boolean;
}

/**
 * Guest Lifecycle Cleanup Task Handler
 * Identify and remediate stale guest accounts based on inactivity threshold
 */
class GuestCleanupHandler implements TaskHandler {
  taskId = "iam:guest-cleanup";
  name = "Guest User Cleanup";
  description = "Identify and remediate stale guest accounts";
  type = "action" as const;
  status = "beta" as const;

  parseArgs(rawArgs: string[]): GuestCleanupArgs {
    const days = parseNumberFlag(rawArgs, "days", 90)!;
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);

    return {
      days,
      dryRun,
    };
  }

  validate(args: GuestCleanupArgs): ValidationResult {
    // Validate days threshold (30-365 days)
    if (args.days < 30 || args.days > 365) {
      return {
        valid: false,
        error: `Invalid inactivity threshold: ${args.days} days. Must be between 30 and 365 days.`,
      };
    }

    return { valid: true };
  }

  async execute(args: GuestCleanupArgs): Promise<void> {
    await cleanupGuests(args.days, args.dryRun);
  }
}

// Auto-register handler on import
TaskRegistry.register(new GuestCleanupHandler());
