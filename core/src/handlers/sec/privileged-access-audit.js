import { TaskRegistry, parseBooleanFlag } from "../registry";
import { auditPrivilegedAccess } from "../../commands/sec/privileged-access-audit";
class PrivilegedAccessHandler {
    taskId = "sec:privileged-access";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditPrivilegedAccess(args.dryRun);
    }
}
TaskRegistry.register(new PrivilegedAccessHandler());
