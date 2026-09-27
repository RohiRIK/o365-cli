import { TaskRegistry, parseBooleanFlag, parseNumberFlag } from "../registry";
import { auditPasswordExpiry } from "../../commands/sec/password-expiry-audit";
class PasswordExpiryHandler {
    taskId = "sec:password-expiry-audit";
    name = "Password Expiry Audit";
    description = "Audit password ages and expiry configurations";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return {
            days: parseNumberFlag(rawArgs, "days", 30),
            dryRun: parseBooleanFlag(rawArgs, "dry-run", false)
        };
    }
    validate(args) {
        if (args.days < 1 || args.days > 365) {
            return {
                valid: false,
                error: `Invalid time range: ${args.days} days. Must be between 1 and 365 days.`,
            };
        }
        return { valid: true };
    }
    async execute(args) {
        await auditPasswordExpiry(args.days, args.dryRun);
    }
}
TaskRegistry.register(new PasswordExpiryHandler());
