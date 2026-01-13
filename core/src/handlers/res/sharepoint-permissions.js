import { TaskRegistry, parseBooleanFlag } from "../registry";
import { auditSharePointPermissions } from "../../commands/res/sharepoint-permissions";
class SharePointPermissionsHandler {
    taskId = "res:sharepoint-permissions";
    name = "SharePoint Permissions Audit";
    description = "Audit permissions across SharePoint sites and files";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditSharePointPermissions(args.dryRun);
    }
}
TaskRegistry.register(new SharePointPermissionsHandler());
