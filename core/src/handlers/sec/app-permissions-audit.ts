import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditAppPermissions } from "../../commands/sec/app-permissions-audit";

interface AppPermissionsArgs extends TaskArgs {
  dryRun: boolean;
}

class AppPermissionsHandler implements TaskHandler {
  taskId = "sec:app-permissions-audit";
  name = "App Permissions Audit";
  description = "Audit high-privilege application permissions";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): AppPermissionsArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
  }

  validate(args: AppPermissionsArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: AppPermissionsArgs): Promise<void> {
    await auditAppPermissions(args.dryRun);
  }
}

TaskRegistry.register(new AppPermissionsHandler());
