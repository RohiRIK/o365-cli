import { TaskRegistry, parseBooleanFlag, } from "../registry";
import { auditWindowsUpdates } from "../../commands/dev/windows-updates";
/**
 * Windows Update Compliance Audit Task Handler
 * Identifies devices with outdated builds, patch gaps, and update ring compliance
 */
class WindowsUpdateHandler {
    taskId = "dev:windows-updates";
    name = "Windows Update Audit";
    description = "Verify patch levels across Windows endpoints";
    type = "audit";
    status = "draft";
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
        await auditWindowsUpdates(args.dryRun);
    }
}
// Auto-register handler on import
TaskRegistry.register(new WindowsUpdateHandler());
