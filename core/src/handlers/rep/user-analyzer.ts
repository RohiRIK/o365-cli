import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseStringFlag,
} from "../registry";
import { analyzeUser } from "../../commands/rep/user-analyzer";

interface UserAnalyzerArgs extends TaskArgs {
  user: string;
}

class UserAnalyzerHandler implements TaskHandler {
  taskId = "rep:user-analyzer";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): UserAnalyzerArgs {
    const user = parseStringFlag(rawArgs, "user", "");
    return { user };
  }

  validate(args: UserAnalyzerArgs): ValidationResult {
    if (!args.user || args.user.trim().length === 0) {
      return {
        valid: false,
        error: "User email is required",
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.user)) {
      return {
        valid: false,
        error: `Invalid email format: ${args.user}`,
      };
    }

    return { valid: true };
  }

  async execute(args: UserAnalyzerArgs): Promise<void> {
    await analyzeUser(args.user);
  }
}

TaskRegistry.register(new UserAnalyzerHandler());
