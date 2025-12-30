import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
} from "../registry";
import { optimizeLicenses } from "../../commands/res/license-optimization";

/**
 * Arguments for license optimization task
 */
interface LicenseOptimizationArgs extends TaskArgs {
  dryRun: boolean;
}

/**
 * License Optimization Task Handler
 * Identifies unused licenses and recommends cost savings
 */
class LicenseOptimizationHandler implements TaskHandler {
  taskId = "res:license-optimization";

  parseArgs(rawArgs: string[]): LicenseOptimizationArgs {
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);

    return {
      dryRun,
    };
  }

  validate(args: LicenseOptimizationArgs): ValidationResult {
    // No validation needed - dry-run is always a boolean
    return { valid: true };
  }

  async execute(args: LicenseOptimizationArgs): Promise<void> {
    await optimizeLicenses(args.dryRun);
  }
}

// Auto-register handler on import
TaskRegistry.register(new LicenseOptimizationHandler());
