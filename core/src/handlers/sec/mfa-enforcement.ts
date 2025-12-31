import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
} from "../registry";
import { auditMFAEnforcement } from "../../commands/sec/mfa-enforcement";

/**
 * Arguments for MFA enforcement audit task
 */
interface MFAEnforcementArgs extends TaskArgs {
  dryRun: boolean;
}

/**
 * MFA Enforcement Audit Task Handler
 * Identify users without MFA, legacy auth usage, and conditional access gaps
 */
class MFAEnforcementHandler implements TaskHandler {
  taskId = "sec:mfa-enforcement";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): MFAEnforcementArgs {
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", false);

    return {
      dryRun,
    };
  }

  validate(args: MFAEnforcementArgs): ValidationResult {
    // No validation needed - no user inputs
    return { valid: true };
  }

  async execute(args: MFAEnforcementArgs): Promise<void> {
    await auditMFAEnforcement(args.dryRun);
  }
}

// Auto-register handler on import
TaskRegistry.register(new MFAEnforcementHandler());
