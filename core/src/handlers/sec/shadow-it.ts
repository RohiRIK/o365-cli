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
class ShadowItHandler implements TaskHandler {
  taskId = "sec:shadow-it";
  name = "Shadow IT Governance";
  description = "Detect and remediate risky OAuth applications";
  type = "action" as const;
  status = "prod" as const;

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
TaskRegistry.register(new ShadowItHandler());