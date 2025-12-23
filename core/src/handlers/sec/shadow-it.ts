import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
} from "../registry";
import { analyzeShadowIT } from "../../commands/sec/shadow-it";

/**
 * Arguments for shadow IT analysis task
 */
interface ShadowITArgs extends TaskArgs {
  dryRun: boolean;
}

/**
 * Shadow IT Governance Task Handler
 * Detect risky OAuth applications with dangerous permissions, unverified publishers, and credential hygiene issues
 */
class ShadowITHandler implements TaskHandler {
  taskId = "sec:shadow-it";

  parseArgs(rawArgs: string[]): ShadowITArgs {
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);

    return {
      dryRun,
    };
  }

  validate(args: ShadowITArgs): ValidationResult {
    // No validation needed - only has dry-run flag
    return { valid: true };
  }

  async execute(args: ShadowITArgs): Promise<void> {
    await analyzeShadowIT(args.dryRun);
  }
}

// Auto-register handler on import
TaskRegistry.register(new ShadowITHandler());
