import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditExternalUserAccess } from "../../commands/sec/external-user-access";

interface ExternalUserAccessArgs extends TaskArgs {
  dryRun: boolean;
}

class ExternalUserAccessHandler implements TaskHandler {
  taskId = "sec:external-user-access";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): ExternalUserAccessArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
  }

  validate(args: ExternalUserAccessArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: ExternalUserAccessArgs): Promise<void> {
    await auditExternalUserAccess(args.dryRun);
  }
}

TaskRegistry.register(new ExternalUserAccessHandler());
