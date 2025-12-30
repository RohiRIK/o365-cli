import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseStringFlag,
} from "../registry";
import { auditIntuneAssignments } from "../../commands/dev/intune-audit";

/**
 * Arguments for Intune Audit
 */
interface IntuneAuditArgs extends TaskArgs {
  dryRun: boolean;
  export?: string;
}

/**
 * Intune Configuration Audit Task Handler
 */
class IntuneAuditHandler implements TaskHandler {
  taskId = "dev:intune-audit";

  parseArgs(rawArgs: string[]): IntuneAuditArgs {
    return {
      dryRun: parseBooleanFlag(rawArgs, "dry-run", true),
      export: parseStringFlag(rawArgs, "export", false),
    };
  }

  validate(_args: IntuneAuditArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: IntuneAuditArgs): Promise<void> {
    await auditIntuneAssignments(args.dryRun, args.export);
  }
}

// Register handler
TaskRegistry.register(new IntuneAuditHandler());
