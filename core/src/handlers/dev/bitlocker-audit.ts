import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditBitLocker } from "../../commands/dev/bitlocker-audit";

interface BitLockerAuditArgs extends TaskArgs {
  dryRun: boolean;
}

class BitLockerAuditHandler implements TaskHandler {
  taskId = "dev:bitlocker-audit";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): BitLockerAuditArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
  }

  validate(args: BitLockerAuditArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: BitLockerAuditArgs): Promise<void> {
    await auditBitLocker(args.dryRun);
  }
}

TaskRegistry.register(new BitLockerAuditHandler());
