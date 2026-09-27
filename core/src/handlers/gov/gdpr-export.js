import { TaskRegistry, parseBooleanFlag, parseStringFlag, } from "../registry";
import { exportGDPRData } from "../../commands/gov/gdpr-export";
/**
 * GDPR User Data Export Task Handler
 * Generate comprehensive GDPR data subject access request (DSAR) export
 */
class GDPRExportHandler {
    taskId = "gov:gdpr-export";
    name = "GDPR Data Export";
    description = "Consolidate user data for right-to-be-forgotten requests";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        const user = parseStringFlag(rawArgs, "user", true);
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", false);
        if (!user) {
            throw new Error("Missing required argument: --user");
        }
        return {
            user,
            dryRun,
        };
    }
    validate(args) {
        // Validate email format
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
        await exportGDPRData(args.user, args.dryRun);
    }
}
// Auto-register handler on import
TaskRegistry.register(new GDPRExportHandler());
