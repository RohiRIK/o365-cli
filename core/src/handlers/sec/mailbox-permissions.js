import { TaskRegistry, parseBooleanFlag } from "../registry";
import { auditMailboxPermissions } from "../../commands/sec/mailbox-permissions";
class MailboxPermissionsHandler {
    taskId = "sec:mailbox-permissions";
    name = "Mailbox Permissions Audit";
    description = "Audit delegate and full access mailbox permissions";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditMailboxPermissions(args.dryRun);
    }
}
TaskRegistry.register(new MailboxPermissionsHandler());
