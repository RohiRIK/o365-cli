import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseStringFlag,
} from "../registry";
import { offboardUser } from "../../commands/iam/offboard";

/**
 * Arguments for IAM offboarding task
 */
interface OffboardArgs extends TaskArgs {
  user: string;
  manager?: string;
  deviceAction: string;
  dryRun: boolean;
}

/**
 * IAM Offboarding Task Handler
 * Comprehensive user offboarding with mailbox preservation, license reclamation, and device cleanup
 */
class OffboardHandler implements TaskHandler {
  taskId = "iam:offboard";

  parseArgs(rawArgs: string[]): OffboardArgs {
    const user = parseStringFlag(rawArgs, "user", true);
    const manager = parseStringFlag(rawArgs, "manager", false);
    const deviceAction = parseStringFlag(rawArgs, "device-action", false) || "retire";
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);

    if (!user) {
      throw new Error("Missing required argument: --user");
    }

    return {
      user,
      manager,
      deviceAction,
      dryRun,
    };
  }

  validate(args: OffboardArgs): ValidationResult {
    // Validate email format for user
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.user)) {
      return {
        valid: false,
        error: `Invalid email format for user: ${args.user}`,
      };
    }

    // Validate manager email if provided
    if (args.manager && !emailRegex.test(args.manager)) {
      return {
        valid: false,
        error: `Invalid email format for manager: ${args.manager}`,
      };
    }

    // Validate device action
    const validActions = ["retire", "wipe", "none"];
    if (!validActions.includes(args.deviceAction)) {
      return {
        valid: false,
        error: `Invalid device action: ${args.deviceAction}. Must be one of: ${validActions.join(", ")}`,
      };
    }

    return { valid: true };
  }

  async execute(args: OffboardArgs): Promise<void> {
    await offboardUser(args.user, args.manager, args.dryRun, args.deviceAction);
  }
}

// Auto-register handler on import
TaskRegistry.register(new OffboardHandler());
