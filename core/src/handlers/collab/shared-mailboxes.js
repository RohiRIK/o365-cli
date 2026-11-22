import { TaskRegistry, } from "../registry";
import { auditSharedMailboxes } from "../../commands/collab/shared-mailboxes";
class SharedMailboxesHandler {
    taskId = "collab:shared-mailboxes";
    name = "Shared Mailbox Audit";
    description = "Audit permissions and usage of shared mailboxes";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return {};
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditSharedMailboxes();
    }
}
TaskRegistry.register(new SharedMailboxesHandler());
