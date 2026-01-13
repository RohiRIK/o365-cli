import { TaskRegistry, parseBooleanFlag } from "../registry";
import { generateExecutiveDashboard } from "../../commands/rep/executive-dashboard";
class ExecutiveDashboardHandler {
    taskId = "rep:executive-dashboard";
    name = "Executive Dashboard";
    description = "High-level overview of tenant health and security";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await generateExecutiveDashboard(args.dryRun);
    }
}
TaskRegistry.register(new ExecutiveDashboardHandler());
