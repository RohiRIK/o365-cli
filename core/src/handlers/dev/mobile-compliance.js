import { TaskRegistry, parseBooleanFlag } from "../registry";
import { auditMobileCompliance } from "../../commands/dev/mobile-compliance";
class MobileComplianceHandler {
    taskId = "dev:mobile-hygiene";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditMobileCompliance(args.dryRun);
    }
}
TaskRegistry.register(new MobileComplianceHandler());
