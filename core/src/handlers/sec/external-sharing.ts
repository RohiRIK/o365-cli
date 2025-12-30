import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditExternalSharing } from "../../commands/sec/external-sharing";

interface ExternalSharingArgs extends TaskArgs {
  dryRun: boolean;
}

class ExternalSharingHandler implements TaskHandler {
  taskId = "sec:external-sharing";

  parseArgs(rawArgs: string[]): ExternalSharingArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: ExternalSharingArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: ExternalSharingArgs): Promise<void> {
    await auditExternalSharing(args.dryRun);
  }
}

TaskRegistry.register(new ExternalSharingHandler());
