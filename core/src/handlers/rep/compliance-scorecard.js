import { TaskRegistry, parseBooleanFlag } from "../registry";
import { generateComplianceScorecard } from "../../commands/rep/compliance-scorecard";
class ComplianceScorecardHandler {
    taskId = "rep:compliance-scorecard";
    name = "Compliance Scorecard";
    description = "Detailed assessment against regulatory frameworks";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await generateComplianceScorecard(args.dryRun);
    }
}
TaskRegistry.register(new ComplianceScorecardHandler());
