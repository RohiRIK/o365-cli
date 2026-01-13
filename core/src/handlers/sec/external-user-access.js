import { TaskRegistry, parseBooleanFlag } from "../registry";
import { auditExternalUserAccess } from "../../commands/sec/external-user-access";
class ExternalUserAccessHandler {
    taskId = "sec:external-user-access";
    name = "External User Access Audit";
    description = "Audit access patterns for external guest users";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditExternalUserAccess(args.dryRun);
    }
}
TaskRegistry.register(new ExternalUserAccessHandler());
