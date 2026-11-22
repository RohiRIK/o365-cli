import { TaskRegistry, parseBooleanFlag, parseNumberFlag, } from "../registry";
import { cleanupStaleDevices } from "../../commands/res/device-cleanup";
class DeviceCleanupHandler {
    taskId = "res:device-cleanup";
    name = "Device Cleanup";
    description = "Identify and remediate stale Intune devices";
    type = "action";
    status = "draft";
    parseArgs(rawArgs) {
        const days = parseNumberFlag(rawArgs, "days", 90);
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);
        return { days, dryRun };
    }
    validate(args) {
        if (args.days < 60 || args.days > 180) {
            return {
                valid: false,
                error: `Invalid inactivity threshold: ${args.days} days. Must be between 60 and 180 days.`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await cleanupStaleDevices(args.days, args.dryRun);
    }
}
TaskRegistry.register(new DeviceCleanupHandler());
