import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditPrivilegedAccess } from "../../commands/sec/privileged-access-audit";

interface PrivilegedAccessArgs extends TaskArgs {
  dryRun: boolean;
}

class PrivilegedAccessHandler implements TaskHandler {
  taskId = "sec:privileged-access";

  parseArgs(rawArgs: string[]): PrivilegedAccessArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: PrivilegedAccessArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: PrivilegedAccessArgs): Promise<void> {
    await auditPrivilegedAccess(args.dryRun);
  }
}

TaskRegistry.register(new PrivilegedAccessHandler());
