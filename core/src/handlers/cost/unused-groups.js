import { TaskRegistry, parseBooleanFlag, parseNumberFlag, } from "../registry";
import { cleanupUnusedGroups } from "../../commands/cost/unused-groups";
class UnusedGroupsHandler {
    taskId = "cost:unused-groups";
    name = "Unused Groups Cleanup";
    description = "Identify and remove orphaned or empty groups";
    type = "action";
    status = "draft";
    parseArgs(rawArgs) {
        const days = parseNumberFlag(rawArgs, "days", 180);
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);
        return { days, dryRun };
    }
    validate(args) {
        if (args.days < 90 || args.days > 365) {
            return {
                valid: false,
                error: `Invalid inactivity threshold: ${args.days} days. Must be between 90 and 365 days.`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await cleanupUnusedGroups(args.days, args.dryRun);
    }
}
TaskRegistry.register(new UnusedGroupsHandler());
