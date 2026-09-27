import { TaskRegistry, parseNumberFlag, } from "../registry";
import { analyzeTeamsSprawl } from "../../commands/rep/teams-sprawl";
class TeamsSprawlHandler {
    taskId = "rep:teams-sprawl";
    name = "Teams Sprawl Report";
    description = "Comprehensive audit of Teams channel sprawl";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        const days = parseNumberFlag(rawArgs, "days", 90);
        return { days };
    }
    validate(args) {
        if (args.days < 30 || args.days > 180) {
            return {
                valid: false,
                error: `Invalid inactivity threshold: ${args.days} days. Must be between 30 and 180 days.`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await analyzeTeamsSprawl(args.days);
    }
}
TaskRegistry.register(new TeamsSprawlHandler());
