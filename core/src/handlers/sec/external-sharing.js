import { TaskRegistry, parseBooleanFlag } from "../registry";
import { auditExternalSharing } from "../../commands/sec/external-sharing";
class ExternalSharingHandler {
    taskId = "sec:external-sharing";
    name = "External Sharing Audit";
    description = "Audit external sharing settings across M365 services";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditExternalSharing(args.dryRun);
    }
}
TaskRegistry.register(new ExternalSharingHandler());
