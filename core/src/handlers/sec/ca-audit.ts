import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseStringFlag,
} from "../registry";
import { GraphService } from "../../services/graph";
import { auditCAPolicies, renderCAPoliciesTable } from "../../commands/sec/ca-audit";
import { IPC } from "../../utils/ipc";

export interface CaAuditArgs extends TaskArgs {
  analyze: boolean;
  state?: string;
  target?: string;
  exportPath?: string;
  configPath?: string;
}

export async function fetchCAPolicies() {
  return await GraphService.fetchAll("/identity/conditionalAccess/policies");
}

class CaAuditHandler implements TaskHandler {
  taskId = "sec:ca-audit";
  name = "Conditional Access Audit";
  description = "Audit and analyze Conditional Access policies";
  type = "audit" as const;
  status = "beta" as const;

  parseArgs(rawArgs: string[]): CaAuditArgs {
    return {
      // Audit modules are always read-only, no dry-run flag needed
      dryRun: true, 
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
    const policies = await auditCAPolicies(args);
    
    if (policies.length === 0) {
      console.log("\nNo policies found matching the criteria.");
      return;
    }

    const table = renderCAPoliciesTable(policies);
    console.log("\n" + table);
    
    // Store for potential export (IPC protocol)
    const headers = ["Policy Name", "State", "Assignments", "Conditions", "Grant Controls"];
    const rows = policies.map(p => [
      p.displayName,
      p.state,
      JSON.stringify(p.conditions?.users),
      JSON.stringify(p.conditions),
      JSON.stringify(p.grantControls)
    ]);
    IPC.table(headers, rows);
  }
}

TaskRegistry.register(new CaAuditHandler());
