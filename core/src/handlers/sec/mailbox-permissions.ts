import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditMailboxPermissions } from "../../commands/sec/mailbox-permissions";

interface MailboxPermissionsArgs extends TaskArgs {
  dryRun: boolean;
}

class MailboxPermissionsHandler implements TaskHandler {
  taskId = "sec:mailbox-permissions";

  parseArgs(rawArgs: string[]): MailboxPermissionsArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: MailboxPermissionsArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: MailboxPermissionsArgs): Promise<void> {
    await auditMailboxPermissions(args.dryRun);
  }
}

TaskRegistry.register(new MailboxPermissionsHandler());
