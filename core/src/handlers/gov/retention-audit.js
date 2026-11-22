import { TaskRegistry, parseBooleanFlag, } from "../registry";
import { auditRetentionPolicies } from "../../commands/gov/retention-audit";
/**
 * Retention Policy Audit Task Handler
 * Audit retention policies across Exchange, SharePoint, Teams
 */
class RetentionAuditHandler {
    taskId = "gov:retention-audit";
    name = "Retention Policy Audit";
    description = "Audit coverage of data retention policies";
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
        await auditRetentionPolicies(args.dryRun);
    }
}
// Auto-register handler on import
TaskRegistry.register(new RetentionAuditHandler());
