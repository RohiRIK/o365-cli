import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditSharePointPermissions } from "../../commands/res/sharepoint-permissions";

interface SharePointPermissionsArgs extends TaskArgs {
  dryRun: boolean;
}

class SharePointPermissionsHandler implements TaskHandler {
  taskId = "res:sharepoint-permissions";

  parseArgs(rawArgs: string[]): SharePointPermissionsArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: SharePointPermissionsArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: SharePointPermissionsArgs): Promise<void> {
    await auditSharePointPermissions(args.dryRun);
  }
}

TaskRegistry.register(new SharePointPermissionsHandler());
