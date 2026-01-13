import { TaskRegistry, parseStringFlag, } from "../registry";
import { executeSurgicalLockdown } from "../../commands/sec/surgical-lockdown";
class SurgicalLockdownHandler {
    taskId = "sec:surgical-lockdown";
    name = "Surgical Lockdown";
    description = "Rapidly isolate compromised accounts and devices";
    type = "action";
    status = "draft";
    parseArgs(rawArgs) {
        const user = parseStringFlag(rawArgs, "user", "");
        return { user };
    }
    validate(args) {
        if (!args.user || args.user.trim() === "") {
            return {
                valid: false,
                error: "User email is required for surgical lockdown. Use --user user@domain.com",
            };
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(args.user)) {
            return {
                valid: false,
                error: `Invalid email format: ${args.user}`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await executeSurgicalLockdown(args.user);
    }
}
TaskRegistry.register(new SurgicalLockdownHandler());
