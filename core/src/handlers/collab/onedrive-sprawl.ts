import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseNumberFlag,
} from "../registry";
import { analyzeOneDriveSprawl } from "../../commands/collab/onedrive-sprawl";

interface OneDriveSprawlArgs extends TaskArgs {
  thresholdGb: number;
  dryRun: boolean;
}

class OneDriveSprawlHandler implements TaskHandler {
  taskId = "collab:onedrive-sprawl";

  parseArgs(rawArgs: string[]): OneDriveSprawlArgs {
    const thresholdGb = parseNumberFlag(rawArgs, "threshold_gb", 500);
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);
    return { thresholdGb, dryRun };
  }

  validate(args: OneDriveSprawlArgs): ValidationResult {
    if (args.thresholdGb < 100 || args.thresholdGb > 5000) {
      return {
        valid: false,
        error: `Invalid storage threshold: ${args.thresholdGb}GB. Must be between 100 and 5000 GB.`,
      };
    }
    return { valid: true };
  }

  async execute(args: OneDriveSprawlArgs): Promise<void> {
    await analyzeOneDriveSprawl(args.thresholdGb, args.dryRun);
  }
}

TaskRegistry.register(new OneDriveSprawlHandler());
