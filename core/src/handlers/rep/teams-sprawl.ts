import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseNumberFlag,
} from "../registry";
import { analyzeTeamsSprawl } from "../../commands/rep/teams-sprawl";

interface TeamsSprawlArgs extends TaskArgs {
  days: number;
}

class TeamsSprawlHandler implements TaskHandler {
  taskId = "rep:teams-sprawl";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): TeamsSprawlArgs {
    const days = parseNumberFlag(rawArgs, "days", 90);
    return { days };
  }

  validate(args: TeamsSprawlArgs): ValidationResult {
    if (args.days < 30 || args.days > 180) {
      return {
        valid: false,
        error: `Invalid inactivity threshold: ${args.days} days. Must be between 30 and 180 days.`,
      };
    }
    return { valid: true };
  }

  async execute(args: TeamsSprawlArgs): Promise<void> {
    await analyzeTeamsSprawl(args.days);
  }
}

TaskRegistry.register(new TeamsSprawlHandler());
