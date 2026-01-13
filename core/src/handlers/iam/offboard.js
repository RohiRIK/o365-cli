import { TaskRegistry, parseBooleanFlag, parseStringFlag, } from "../registry";
import { offboardUser } from "../../commands/iam/offboard";
/**
 * Graceful Offboarding Task Handler
 * Standard user termination protocol with license reclamation and mailbox conversion
 */
class OffboardHandler {
    taskId = "iam:offboard";
    name = "Graceful Offboarding";
    description = "Standard user termination protocol with license reclaim";
    type = "action";
    status = "prod";
    parseArgs(rawArgs) {
        const user = parseStringFlag(rawArgs, "user", true);
        const manager = parseStringFlag(rawArgs, "manager", false);
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);
        const deviceAction = parseStringFlag(rawArgs, "device-action", false) || "retire";
        return {
            user,
            manager,
            dryRun,
            deviceAction,
        };
    }
    validate(args) {
        if (!args.user || !args.user.includes("@")) {
            return { valid: false, error: "Valid user email is required" };
        }
        return { valid: true };
    }
    async execute(args) {
        await offboardUser(args.user, args.manager, args.dryRun, args.deviceAction);
    }
}
// Auto-register handler on import
TaskRegistry.register(new OffboardHandler());
