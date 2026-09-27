import { TaskRegistry, parseBooleanFlag } from "../registry";
import { checkSecurityDefaults } from "../../commands/sec/security-defaults-check";
class SecurityDefaultsHandler {
    taskId = "sec:security-defaults-check";
    name = "Security Defaults Check";
    description = "Verify Microsoft Security Defaults configuration";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await checkSecurityDefaults(args.dryRun);
    }
}
TaskRegistry.register(new SecurityDefaultsHandler());
