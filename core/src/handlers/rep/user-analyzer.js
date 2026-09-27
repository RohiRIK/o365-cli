import { TaskRegistry, parseStringFlag, } from "../registry";
import { analyzeUser } from "../../commands/rep/user-analyzer";
class UserAnalyzerHandler {
    taskId = "rep:user-analyzer";
    name = "360 User Analyzer";
    description = "Deep dive forensic report for specific users";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        const user = parseStringFlag(rawArgs, "user", "");
        return { user };
    }
    validate(args) {
        if (!args.user || args.user.trim().length === 0) {
            return {
                valid: false,
                error: "User email is required",
            };
        }
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
        await analyzeUser(args.user);
    }
}
TaskRegistry.register(new UserAnalyzerHandler());
