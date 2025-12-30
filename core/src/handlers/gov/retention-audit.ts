import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
} from "../registry";
import { auditRetentionPolicies } from "../../commands/gov/retention-audit";

/**
 * Arguments for retention policy audit task
 */
interface RetentionAuditArgs extends TaskArgs {
  dryRun: boolean;
}

/**
 * Retention Policy Audit Task Handler
 * Audit retention policies across Exchange, SharePoint, Teams
 */
class RetentionAuditHandler implements TaskHandler {
  taskId = "gov:retention-audit";

  parseArgs(rawArgs: string[]): RetentionAuditArgs {
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);

    return {
      dryRun,
    };
  }

  validate(args: RetentionAuditArgs): ValidationResult {
    // No validation needed - no user inputs
    return { valid: true };
  }

  async execute(args: RetentionAuditArgs): Promise<void> {
    await auditRetentionPolicies(args.dryRun);
  }
}

// Auto-register handler on import
TaskRegistry.register(new RetentionAuditHandler());
