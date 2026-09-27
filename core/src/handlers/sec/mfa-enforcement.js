import { TaskRegistry, parseBooleanFlag, } from "../registry";
import { auditMFAEnforcement } from "../../commands/sec/mfa-enforcement";
/**
 * MFA Enforcement Audit Task Handler
 * Identify users without MFA, legacy auth usage, and conditional access gaps
 */
class MFAEnforcementHandler {
    taskId = "sec:mfa-enforcement";
    name = "MFA Enforcement Audit";
    description = "Verify MFA enrollment and enforcement status";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", false);
        return {
            dryRun,
        };
    }
    validate(args) {
        // No validation needed - no user inputs
        return { valid: true };
    }
    async execute(args) {
        await auditMFAEnforcement(args.dryRun);
    }
}
// Auto-register handler on import
TaskRegistry.register(new MFAEnforcementHandler());
