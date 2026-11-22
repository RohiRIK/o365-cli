import { TaskRegistry, parseBooleanFlag, parseNumberFlag } from "../registry";
import { analyzeTeamsUsage } from "../../commands/res/teams-usage";
class TeamsUsageHandler {
    taskId = "res:teams-usage";
    name = "Teams Usage Audit";
    description = "Analyze Teams adoption and activity metrics";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return {
            days: parseNumberFlag(rawArgs, "days", 90),
            dryRun: parseBooleanFlag(rawArgs, "dry-run", false)
        };
    }
    validate(args) {
        if (args.days < 7 || args.days > 365) {
            return {
                valid: false,
                error: `Invalid time range: ${args.days} days. Must be between 7 and 365 days.`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await analyzeTeamsUsage(args.days, args.dryRun);
    }
}
TaskRegistry.register(new TeamsUsageHandler());
