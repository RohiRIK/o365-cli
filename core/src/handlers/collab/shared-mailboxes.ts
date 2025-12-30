import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
} from "../registry";
import { auditSharedMailboxes } from "../../commands/collab/shared-mailboxes";

interface SharedMailboxesArgs extends TaskArgs {}

class SharedMailboxesHandler implements TaskHandler {
  taskId = "collab:shared-mailboxes";

  parseArgs(rawArgs: string[]): SharedMailboxesArgs {
    return {};
  }

  validate(args: SharedMailboxesArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: SharedMailboxesArgs): Promise<void> {
    await auditSharedMailboxes();
  }
}

TaskRegistry.register(new SharedMailboxesHandler());
