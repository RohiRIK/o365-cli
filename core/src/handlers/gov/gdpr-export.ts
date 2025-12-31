import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseStringFlag,
} from "../registry";
import { exportGDPRData } from "../../commands/gov/gdpr-export";

/**
 * Arguments for GDPR export task
 */
interface GDPRExportArgs extends TaskArgs {
  user: string;
  dryRun: boolean;
}

/**
 * GDPR User Data Export Task Handler
 * Generate comprehensive GDPR data subject access request (DSAR) export
 */
class GDPRExportHandler implements TaskHandler {
  taskId = "gov:gdpr-export";
  name = "GDPR Data Export";
  description = "Consolidate user data for right-to-be-forgotten requests";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): GDPRExportArgs {
    const user = parseStringFlag(rawArgs, "user", true);
    const dryRun = parseBooleanFlag(rawArgs, "dry-run", false);

    if (!user) {
      throw new Error("Missing required argument: --user");
    }

    return {
      user,
      dryRun,
    };
  }

  validate(args: GDPRExportArgs): ValidationResult {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.user)) {
      return {
        valid: false,
        error: `Invalid email format: ${args.user}`,
      };
    }

    return { valid: true };
  }

  async execute(args: GDPRExportArgs): Promise<void> {
    await exportGDPRData(args.user, args.dryRun);
  }
}

// Auto-register handler on import
TaskRegistry.register(new GDPRExportHandler());
