import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { checkSecurityDefaults } from "../../commands/sec/security-defaults-check";

interface SecurityDefaultsArgs extends TaskArgs {
  dryRun: boolean;
}

class SecurityDefaultsHandler implements TaskHandler {
  taskId = "sec:security-defaults-check";
  name = "Security Defaults Check";
  description = "Verify Microsoft Security Defaults configuration";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): SecurityDefaultsArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
  }

  validate(args: SecurityDefaultsArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: SecurityDefaultsArgs): Promise<void> {
    await checkSecurityDefaults(args.dryRun);
  }
}

TaskRegistry.register(new SecurityDefaultsHandler());
