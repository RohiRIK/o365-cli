import { TaskRegistry, parseBooleanFlag } from "../registry";
import { auditBitLocker } from "../../commands/dev/bitlocker-audit";
class BitLockerAuditHandler {
    taskId = "dev:bitlocker-audit";
    name = "BitLocker Key Audit";
    description = "Verify presence of BitLocker recovery keys";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditBitLocker(args.dryRun);
    }
}
TaskRegistry.register(new BitLockerAuditHandler());
