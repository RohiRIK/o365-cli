import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseNumberFlag,
} from "../registry";
import { detectRiskySignIns } from "../../commands/sec/risky-sign-ins";

interface RiskySignInsArgs extends TaskArgs {
  days: number;
  dryRun: boolean;
}

class RiskySignInsHandler implements TaskHandler {
  taskId = "sec:risky-signins";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): RiskySignInsArgs {
    const days = parseNumberFlag(rawArgs, "days", 7);
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", false);
    return { days, dryRun };
  }

  validate(args: RiskySignInsArgs): ValidationResult {
    if (args.days < 1 || args.days > 90) {
      return {
        valid: false,
        error: `Invalid time range: ${args.days} days. Must be between 1 and 90 days.`,
      };
    }
    return { valid: true };
  }

  async execute(args: RiskySignInsArgs): Promise<void> {
    await detectRiskySignIns(args.days, args.dryRun);
  }
}

TaskRegistry.register(new RiskySignInsHandler());
