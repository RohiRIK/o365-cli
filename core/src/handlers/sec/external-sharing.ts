import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditExternalSharing } from "../../commands/sec/external-sharing";

interface ExternalSharingArgs extends TaskArgs {
  dryRun: boolean;
}

class ExternalSharingHandler implements TaskHandler {
  taskId = "sec:external-sharing";
  name = "External Sharing Audit";
  description = "Audit external sharing settings across M365 services";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): ExternalSharingArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
  }

  validate(args: ExternalSharingArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: ExternalSharingArgs): Promise<void> {
    await auditExternalSharing(args.dryRun);
  }
}

TaskRegistry.register(new ExternalSharingHandler());
