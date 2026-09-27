import { TaskRegistry, parseBooleanFlag, parseNumberFlag, } from "../registry";
import { detectRiskySignIns } from "../../commands/sec/risky-sign-ins";
class RiskySignInsHandler {
    taskId = "sec:risky-signins";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        const days = parseNumberFlag(rawArgs, "days", 7);
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", false);
        return { days, dryRun };
    }
    validate(args) {
        if (args.days < 1 || args.days > 90) {
            return {
                valid: false,
                error: `Invalid time range: ${args.days} days. Must be between 1 and 90 days.`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await detectRiskySignIns(args.days, args.dryRun);
    }
}
TaskRegistry.register(new RiskySignInsHandler());
