import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
} from "../registry";
import { reclaimLicenses } from "../../commands/iam/license-reclaim";

interface LicenseReclaimArgs extends TaskArgs {
  dryRun: boolean;
}

class LicenseReclaimHandler implements TaskHandler {
  taskId = "iam:license-reclaim";
  name = "License Reclamation";
  description = "Identify and reclaim unused M365 licenses";
  type = "action" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): LicenseReclaimArgs {
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);
    return { dryRun };
  }

  validate(args: LicenseReclaimArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: LicenseReclaimArgs): Promise<void> {
    await reclaimLicenses(args.dryRun);
  }
}

TaskRegistry.register(new LicenseReclaimHandler());
