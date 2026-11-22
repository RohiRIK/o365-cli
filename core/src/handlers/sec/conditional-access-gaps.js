import { TaskRegistry, parseBooleanFlag } from "../registry";
import { analyzeConditionalAccessGaps } from "../../commands/sec/conditional-access-gaps";
class ConditionalAccessGapsHandler {
    taskId = "sec:conditional-access";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await analyzeConditionalAccessGaps(args.dryRun);
    }
}
TaskRegistry.register(new ConditionalAccessGapsHandler());
