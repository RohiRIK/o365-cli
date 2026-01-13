import { TaskRegistry, parseBooleanFlag, parseNumberFlag } from "../registry";
import { detectStaleDevices } from "../../commands/dev/stale-devices";
class StaleDevicesHandler {
    taskId = "dev:stale-devices";
    name = "Stale Devices Cleanup";
    description = "Identify and remove inactive Intune devices";
    type = "action";
    status = "draft";
    parseArgs(rawArgs) {
        return {
            days: parseNumberFlag(rawArgs, "days", 90),
            dryRun: parseBooleanFlag(rawArgs, "dry-run", true)
        };
    }
    validate(args) {
        if (args.days < 30 || args.days > 365) {
            return {
                valid: false,
                error: `Invalid inactivity threshold: ${args.days} days. Must be between 30 and 365 days.`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await detectStaleDevices(args.days, args.dryRun);
    }
}
TaskRegistry.register(new StaleDevicesHandler());
