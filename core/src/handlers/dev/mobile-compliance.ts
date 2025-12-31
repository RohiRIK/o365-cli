import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditMobileCompliance } from "../../commands/dev/mobile-compliance";

interface MobileComplianceArgs extends TaskArgs {
  dryRun: boolean;
}

class MobileComplianceHandler implements TaskHandler {
  taskId = "dev:mobile-hygiene";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): MobileComplianceArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
  }

  validate(args: MobileComplianceArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: MobileComplianceArgs): Promise<void> {
    await auditMobileCompliance(args.dryRun);
  }
}

TaskRegistry.register(new MobileComplianceHandler());
