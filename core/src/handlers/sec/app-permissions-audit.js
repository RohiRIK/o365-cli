import { TaskRegistry, parseBooleanFlag } from "../registry";
import { auditAppPermissions } from "../../commands/sec/app-permissions-audit";
class AppPermissionsHandler {
    taskId = "sec:app-permissions-audit";
    name = "App Permissions Audit";
    description = "Audit high-privilege application permissions";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditAppPermissions(args.dryRun);
    }
}
TaskRegistry.register(new AppPermissionsHandler());
