import { TaskRegistry, parseBooleanFlag, } from "../registry";
import { optimizeLicenses } from "../../commands/res/license-optimization";
/**
 * License Optimization Task Handler
 * Identifies unused licenses and recommends cost savings
 */
class LicenseOptimizationHandler {
    taskId = "res:license-optimization";
    name = "License Optimization";
    description = "Analyze license allocation for cost savings";
    type = "audit";
    status = "beta";
    parseArgs(rawArgs) {
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", false);
        return {
            dryRun,
        };
    }
    validate(args) {
        // No validation needed - dry-run is always a boolean
        return { valid: true };
    }
    async execute(args) {
        await optimizeLicenses(args.dryRun);
    }
}
// Auto-register handler on import
TaskRegistry.register(new LicenseOptimizationHandler());
