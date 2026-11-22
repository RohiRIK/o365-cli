import { TaskRegistry, parseBooleanFlag, parseNumberFlag } from "../registry";
import { detectInactiveGroups } from "../../commands/res/inactive-groups";
class InactiveGroupsHandler {
    taskId = "res:inactive-groups";
    name = "Inactive Groups Audit";
    description = "Identify stale M365 and security groups";
    type = "action";
    status = "draft";
    parseArgs(rawArgs) {
        return {
            days: parseNumberFlag(rawArgs, "days", 90),
            dryRun: parseBooleanFlag(rawArgs, "dry-run", true)
        };
    }
    validate(args) {
        if (args.days < 30 || args.days > 365) {
            return {
                valid: false,
                error: `Invalid inactivity threshold: ${args.days} days. Must be between 30 and 365 days.`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await detectInactiveGroups(args.days, args.dryRun);
    }
}
TaskRegistry.register(new InactiveGroupsHandler());
