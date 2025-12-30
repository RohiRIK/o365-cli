import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseStringFlag,
} from "../registry";
import { exportAuditLogs } from "../../commands/gov/audit-log-export";

/**
 * Arguments for audit log export task
 */
interface AuditLogExportArgs extends TaskArgs {
  startDate: string;
  endDate: string;
  operations?: string;
  dryRun: boolean;
}

/**
 * Unified Audit Log Export Task Handler
 * Export filtered audit logs for compliance investigations
 */
class AuditLogExportHandler implements TaskHandler {
  taskId = "gov:audit-log-export";

  parseArgs(rawArgs: string[]): AuditLogExportArgs {
    const startDate = parseStringFlag(rawArgs, "start-date", true);
    const endDate = parseStringFlag(rawArgs, "end-date", true);
    const operations = parseStringFlag(rawArgs, "operations", false);
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);

    if (!startDate || !endDate) {
      throw new Error("Missing required arguments: --start-date and --end-date");
    }

    return {
      startDate,
      endDate,
      operations,
      dryRun,
    };
  }

  validate(args: AuditLogExportArgs): ValidationResult {
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(args.startDate)) {
      return {
        valid: false,
        error: `Invalid start date format: ${args.startDate}. Use YYYY-MM-DD (e.g., 2025-01-01)`,
      };
    }

    if (!dateRegex.test(args.endDate)) {
      return {
        valid: false,
        error: `Invalid end date format: ${args.endDate}. Use YYYY-MM-DD (e.g., 2025-01-31)`,
      };
    }

    // Validate date range
    const start = new Date(args.startDate);
    const end = new Date(args.endDate);

    if (start > end) {
      return {
        valid: false,
        error: "Start date must be before or equal to end date",
      };
    }

    // Validate maximum range (1 year)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return {
        valid: false,
        error: `Date range too large: ${daysDiff} days. Maximum allowed: 365 days`,
      };
    }

    return { valid: true };
  }

  async execute(args: AuditLogExportArgs): Promise<void> {
    await exportAuditLogs(args.startDate, args.endDate, args.operations, args.dryRun);
  }
}

// Auto-register handler on import
TaskRegistry.register(new AuditLogExportHandler());
