import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditMacOSUpdates } from "../../commands/dev/macos-updates";

interface MacOSUpdatesArgs extends TaskArgs {
  dryRun: boolean;
}

class MacOSUpdatesHandler implements TaskHandler {
  taskId = "dev:macos-compliance";

  parseArgs(rawArgs: string[]): MacOSUpdatesArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: MacOSUpdatesArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: MacOSUpdatesArgs): Promise<void> {
    await auditMacOSUpdates(args.dryRun);
  }
}

TaskRegistry.register(new MacOSUpdatesHandler());
