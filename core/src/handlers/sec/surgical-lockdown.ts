import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseStringFlag,
} from "../registry";
import { executeSurgicalLockdown } from "../../commands/sec/surgical-lockdown";

interface SurgicalLockdownArgs extends TaskArgs {
  user: string;
}

class SurgicalLockdownHandler implements TaskHandler {
  taskId = "sec:surgical-lockdown";

  parseArgs(rawArgs: string[]): SurgicalLockdownArgs {
    const user = parseStringFlag(rawArgs, "user", "");
    return { user };
  }

  validate(args: SurgicalLockdownArgs): ValidationResult {
    if (!args.user || args.user.trim() === "") {
      return {
        valid: false,
        error: "User email is required for surgical lockdown. Use --user user@domain.com",
      };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.user)) {
      return {
        valid: false,
        error: `Invalid email format: ${args.user}`,
      };
    }

    return { valid: true };
  }

  async execute(args: SurgicalLockdownArgs): Promise<void> {
    await executeSurgicalLockdown(args.user);
  }
}

TaskRegistry.register(new SurgicalLockdownHandler());
