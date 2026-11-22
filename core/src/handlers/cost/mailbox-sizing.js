import { TaskRegistry, parseBooleanFlag, parseNumberFlag, } from "../registry";
import { analyzeMailboxSizing } from "../../commands/cost/mailbox-sizing";
class MailboxSizingHandler {
    taskId = "cost:mailbox-sizing";
    name = "Mailbox Sizing Audit";
    description = "Identify oversized or underutilized mailboxes";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        const thresholdGb = parseNumberFlag(rawArgs, "threshold_gb", 50);
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", false);
        return { thresholdGb, dryRun };
    }
    validate(args) {
        if (args.thresholdGb < 25 || args.thresholdGb > 100) {
            return {
                valid: false,
                error: `Invalid threshold: ${args.thresholdGb}GB. Must be between 25 and 100 GB.`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await analyzeMailboxSizing(args.thresholdGb, args.dryRun);
    }
}
TaskRegistry.register(new MailboxSizingHandler());
