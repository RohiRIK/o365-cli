import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
} from "../registry";
import { auditWindowsUpdates } from "../../commands/dev/windows-updates";

/**
 * Arguments for Windows Update audit task
 */
interface WindowsUpdateArgs extends TaskArgs {
  dryRun: boolean;
}

/**
 * Windows Update Compliance Audit Task Handler
 * Identifies devices with outdated builds, patch gaps, and update ring compliance
 */
class WindowsUpdateHandler implements TaskHandler {
  taskId = "dev:windows-updates";
  name = "Windows Update Audit";
  description = "Verify patch levels across Windows endpoints";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): WindowsUpdateArgs {
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", false);

    return {
      dryRun,
    };
  }

  validate(args: WindowsUpdateArgs): ValidationResult {
    // No validation needed - dry-run is always a boolean
    return { valid: true };
  }

  async execute(args: WindowsUpdateArgs): Promise<void> {
    await auditWindowsUpdates(args.dryRun);
  }
}

// Auto-register handler on import
TaskRegistry.register(new WindowsUpdateHandler());
