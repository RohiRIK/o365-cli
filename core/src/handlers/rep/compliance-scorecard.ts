import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { generateComplianceScorecard } from "../../commands/rep/compliance-scorecard";

interface ComplianceScorecardArgs extends TaskArgs {
  dryRun: boolean;
}

class ComplianceScorecardHandler implements TaskHandler {
  taskId = "rep:compliance-scorecard";

  parseArgs(rawArgs: string[]): ComplianceScorecardArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: ComplianceScorecardArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: ComplianceScorecardArgs): Promise<void> {
    await generateComplianceScorecard(args.dryRun);
  }
}

TaskRegistry.register(new ComplianceScorecardHandler());
