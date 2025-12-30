import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditPowerPlatformLicenses } from "../../commands/cost/power-platform";

/**
 * Power Platform License Audit Handler
 * Identifies unused Power Apps, Power Automate, and Power BI premium licenses
 */
interface PowerPlatformArgs extends TaskArgs {
  dryRun: boolean;
}

class PowerPlatformHandler implements TaskHandler {
  taskId = "cost:power-platform";

  parseArgs(rawArgs: string[]): PowerPlatformArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: PowerPlatformArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: PowerPlatformArgs): Promise<void> {
    await auditPowerPlatformLicenses(args.dryRun);
  }
}

TaskRegistry.register(new PowerPlatformHandler());
