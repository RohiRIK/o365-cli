import { TaskRegistry, parseBooleanFlag, parseNumberFlag, } from "../registry";
import { cleanupGuests } from "../../commands/iam/guest-cleanup";
/**
 * Guest Lifecycle Cleanup Task Handler
 * Identify and remediate stale guest accounts based on inactivity threshold
 */
class GuestCleanupHandler {
    taskId = "iam:guest-cleanup";
    name = "Guest User Cleanup";
    description = "Identify and remediate stale guest accounts";
    type = "action";
    status = "beta";
    parseArgs(rawArgs) {
        const days = parseNumberFlag(rawArgs, "days", 90);
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);
        return {
            days,
            dryRun,
        };
    }
    validate(args) {
        // Validate days threshold (30-365 days)
        if (args.days < 30 || args.days > 365) {
            return {
                valid: false,
                error: `Invalid inactivity threshold: ${args.days} days. Must be between 30 and 365 days.`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await cleanupGuests(args.days, args.dryRun);
    }
}
// Auto-register handler on import
TaskRegistry.register(new GuestCleanupHandler());
