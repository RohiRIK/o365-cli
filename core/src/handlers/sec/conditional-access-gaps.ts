import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { analyzeConditionalAccessGaps } from "../../commands/sec/conditional-access-gaps";

interface ConditionalAccessGapsArgs extends TaskArgs {
  dryRun: boolean;
}

class ConditionalAccessGapsHandler implements TaskHandler {
  taskId = "sec:conditional-access";

  parseArgs(rawArgs: string[]): ConditionalAccessGapsArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: ConditionalAccessGapsArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: ConditionalAccessGapsArgs): Promise<void> {
    await analyzeConditionalAccessGaps(args.dryRun);
  }
}

TaskRegistry.register(new ConditionalAccessGapsHandler());
