import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseStringFlag,
} from "../registry";

export interface CaAuditArgs extends TaskArgs {
  analyze: boolean;
  state?: string;
  target?: string;
  exportPath?: string;
  configPath?: string;
}

class CaAuditHandler implements TaskHandler {
  taskId = "sec:ca-audit";
  name = "Conditional Access Audit";
  description = "Audit and analyze Conditional Access policies";
  type = "audit" as const;
  status = "beta" as const;

  parseArgs(rawArgs: string[]): CaAuditArgs {
    return {
      dryRun: parseBooleanFlag(rawArgs, "dry-run", true),
      analyze: parseBooleanFlag(rawArgs, "analyze", false),
      state: parseStringFlag(rawArgs, "state"),
      target: parseStringFlag(rawArgs, "target"),
      exportPath: parseStringFlag(rawArgs, "export"),
      configPath: parseStringFlag(rawArgs, "config"),
    };
  }

  validate(args: CaAuditArgs): ValidationResult {
    if (args.state && !["enabled", "disabled", "reportOnly"].includes(args.state)) {
      return { valid: false, error: "Invalid state. Must be enabled, disabled, or reportOnly" };
    }
    return { valid: true };
  }

  async execute(args: CaAuditArgs): Promise<void> {
    console.log("Executing CA Audit with args:", args);
    // Implementation to follow in later tasks
  }
}

TaskRegistry.register(new CaAuditHandler());
