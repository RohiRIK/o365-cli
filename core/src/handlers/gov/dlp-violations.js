import { TaskRegistry, parseBooleanFlag, parseNumberFlag, } from "../registry";
import { generateDLPViolationReport } from "../../commands/gov/dlp-violations";
/**
 * DLP Violation Report Task Handler
 * Generate DLP policy violation report
 */
class DLPViolationHandler {
    taskId = "gov:dlp-violations";
    name = "DLP Violations Report";
    description = "Analyze and report on data loss prevention events";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        const days = parseNumberFlag(rawArgs, "days", false) || 30;
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", false);
        return {
            days,
            dryRun,
        };
    }
    validate(args) {
        // Validate days range (7-90)
        if (args.days < 7 || args.days > 90) {
            return {
                valid: false,
                error: `Lookback period must be between 7 and 90 days. Got: ${args.days}`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await generateDLPViolationReport(args.days, args.dryRun);
    }
}
// Auto-register handler on import
TaskRegistry.register(new DLPViolationHandler());
