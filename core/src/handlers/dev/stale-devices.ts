import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag, parseNumberFlag } from "../registry";
import { detectStaleDevices } from "../../commands/dev/stale-devices";

interface StaleDevicesArgs extends TaskArgs {
  days: number;
  dryRun: boolean;
}

class StaleDevicesHandler implements TaskHandler {
  taskId = "dev:stale-devices";
  type = "action" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): StaleDevicesArgs {
    return {
      days: parseNumberFlag(rawArgs, "days", 90),
      dryRun: parseBooleanFlag(rawArgs, "dry-run", true)
    };
  }

  validate(args: StaleDevicesArgs): ValidationResult {
    if (args.days < 30 || args.days > 365) {
      return {
        valid: false,
        error: `Invalid inactivity threshold: ${args.days} days. Must be between 30 and 365 days.`,
      };
    }
    return { valid: true };
  }

  async execute(args: StaleDevicesArgs): Promise<void> {
    await detectStaleDevices(args.days, args.dryRun);
  }
}

TaskRegistry.register(new StaleDevicesHandler());
