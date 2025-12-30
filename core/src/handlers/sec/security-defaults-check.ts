import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { checkSecurityDefaults } from "../../commands/sec/security-defaults-check";

interface SecurityDefaultsArgs extends TaskArgs {
  dryRun: boolean;
}

class SecurityDefaultsHandler implements TaskHandler {
  taskId = "sec:security-defaults-check";

  parseArgs(rawArgs: string[]): SecurityDefaultsArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: SecurityDefaultsArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: SecurityDefaultsArgs): Promise<void> {
    await checkSecurityDefaults(args.dryRun);
  }
}

TaskRegistry.register(new SecurityDefaultsHandler());
