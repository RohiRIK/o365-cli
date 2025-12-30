import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseNumberFlag,
} from "../registry";
import { generateDLPViolationReport } from "../../commands/gov/dlp-violations";

/**
 * Arguments for DLP violation report task
 */
interface DLPViolationArgs extends TaskArgs {
  days: number;
  dryRun: boolean;
}

/**
 * DLP Violation Report Task Handler
 * Generate DLP policy violation report
 */
class DLPViolationHandler implements TaskHandler {
  taskId = "gov:dlp-violations";

  parseArgs(rawArgs: string[]): DLPViolationArgs {
    const days = parseNumberFlag(rawArgs, "days", false) || 30;
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);

    return {
      days,
      dryRun,
    };
  }

  validate(args: DLPViolationArgs): ValidationResult {
    // Validate days range (7-90)
    if (args.days < 7 || args.days > 90) {
      return {
        valid: false,
        error: `Lookback period must be between 7 and 90 days. Got: ${args.days}`,
      };
    }

    return { valid: true };
  }

  async execute(args: DLPViolationArgs): Promise<void> {
    await generateDLPViolationReport(args.days, args.dryRun);
  }
}

// Auto-register handler on import
TaskRegistry.register(new DLPViolationHandler());
