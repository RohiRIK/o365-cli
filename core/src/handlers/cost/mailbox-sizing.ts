import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseNumberFlag,
} from "../registry";
import { analyzeMailboxSizing } from "../../commands/cost/mailbox-sizing";

interface MailboxSizingArgs extends TaskArgs {
  thresholdGb: number;
  dryRun: boolean;
}

class MailboxSizingHandler implements TaskHandler {
  taskId = "cost:mailbox-sizing";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): MailboxSizingArgs {
    const thresholdGb = parseNumberFlag(rawArgs, "threshold_gb", 50);
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", false);
    return { thresholdGb, dryRun };
  }

  validate(args: MailboxSizingArgs): ValidationResult {
    if (args.thresholdGb < 25 || args.thresholdGb > 100) {
      return {
        valid: false,
        error: `Invalid threshold: ${args.thresholdGb}GB. Must be between 25 and 100 GB.`,
      };
    }
    return { valid: true };
  }

  async execute(args: MailboxSizingArgs): Promise<void> {
    await analyzeMailboxSizing(args.thresholdGb, args.dryRun);
  }
}

TaskRegistry.register(new MailboxSizingHandler());
