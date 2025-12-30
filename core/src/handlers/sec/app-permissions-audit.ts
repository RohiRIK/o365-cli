import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditAppPermissions } from "../../commands/sec/app-permissions-audit";

interface AppPermissionsArgs extends TaskArgs {
  dryRun: boolean;
}

class AppPermissionsHandler implements TaskHandler {
  taskId = "sec:app-permissions-audit";

  parseArgs(rawArgs: string[]): AppPermissionsArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: AppPermissionsArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: AppPermissionsArgs): Promise<void> {
    await auditAppPermissions(args.dryRun);
  }
}

TaskRegistry.register(new AppPermissionsHandler());
