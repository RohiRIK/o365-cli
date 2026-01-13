import { TaskRegistry, parseBooleanFlag, parseNumberFlag, } from "../registry";
import { detectStaleAccounts } from "../../commands/iam/stale-accounts";
class StaleAccountsHandler {
    taskId = "iam:stale-accounts";
    name = "Stale Accounts Audit";
    description = "Identify inactive user accounts for remediation";
    type = "action";
    status = "draft";
    parseArgs(rawArgs) {
        const days = parseNumberFlag(rawArgs, "days", 180);
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);
        return { days, dryRun };
    }
    validate(args) {
        if (args.days < 30 || args.days > 730) {
            return {
                valid: false,
                error: `Invalid inactivity threshold: ${args.days} days. Must be between 30 and 730 days.`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await detectStaleAccounts(args.days, args.dryRun);
    }
}
TaskRegistry.register(new StaleAccountsHandler());
