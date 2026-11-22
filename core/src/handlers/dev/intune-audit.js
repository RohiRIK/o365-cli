import { TaskRegistry, parseBooleanFlag, parseStringFlag, } from "../registry";
import { auditIntuneAssignments } from "../../commands/dev/intune-audit";
/**
 * Intune Configuration Audit Task Handler
 */
class IntuneAuditHandler {
    taskId = "dev:intune-audit";
    name = "Intune Configuration Audit";
    description = "Audit Intune assignments and configuration profiles";
    type = "audit";
    status = "prod";
    parseArgs(rawArgs) {
        return {
            dryRun: parseBooleanFlag(rawArgs, "dry-run", false),
            export: parseStringFlag(rawArgs, "export", false),
        };
    }
    validate(_args) {
        return { valid: true };
    }
    async execute(args) {
        await auditIntuneAssignments(args.dryRun, args.export);
    }
}
// Register handler
TaskRegistry.register(new IntuneAuditHandler());
