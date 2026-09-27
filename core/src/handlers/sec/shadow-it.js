import { TaskRegistry, parseBooleanFlag, } from "../registry";
import { analyzeShadowIT } from "../../commands/sec/shadow-it";
/**
 * Shadow IT Governance Task Handler
 * Detect risky OAuth applications with dangerous permissions, unverified publishers, and credential hygiene issues
 */
class ShadowItHandler {
    taskId = "sec:shadow-it";
    name = "Shadow IT Governance";
    description = "Detect and remediate risky OAuth applications";
    type = "action";
    status = "prod";
    parseArgs(rawArgs) {
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);
        return {
            dryRun,
        };
    }
    validate(args) {
        // No validation needed - only has dry-run flag
        return { valid: true };
    }
    async execute(args) {
        await analyzeShadowIT(args.dryRun);
    }
}
// Auto-register handler on import
TaskRegistry.register(new ShadowItHandler());
