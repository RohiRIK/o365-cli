import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseNumberFlag,
} from "../registry";
import { cleanupStaleDevices } from "../../commands/res/device-cleanup";

interface DeviceCleanupArgs extends TaskArgs {
  days: number;
  dryRun: boolean;
}

class DeviceCleanupHandler implements TaskHandler {
  taskId = "res:device-cleanup";
  name = "Device Cleanup";
  description = "Identify and remediate stale Intune devices";
  type = "action" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): DeviceCleanupArgs {
    const days = parseNumberFlag(rawArgs, "days", 90);
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);
    return { days, dryRun };
  }

  validate(args: DeviceCleanupArgs): ValidationResult {
    if (args.days < 60 || args.days > 180) {
      return {
        valid: false,
        error: `Invalid inactivity threshold: ${args.days} days. Must be between 60 and 180 days.`,
      };
    }
    return { valid: true };
  }

  async execute(args: DeviceCleanupArgs): Promise<void> {
    await cleanupStaleDevices(args.days, args.dryRun);
  }
}

TaskRegistry.register(new DeviceCleanupHandler());
