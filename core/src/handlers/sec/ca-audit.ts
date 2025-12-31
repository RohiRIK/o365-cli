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
    IPC.progress("Fetching Conditional Access policies...", 10);
    const policies = await auditCAPolicies(args);
    
    if (!policies || policies.length === 0) {
      IPC.log("No Conditional Access policies found matching the criteria.", "warn");
      return;
    }

    IPC.progress(`Analyzing ${policies.length} policies...`, 50);
    
    const headers = ["Policy Name", "State", "Assignments", "Conditions", "Grant Controls"];
    const tableRows = policies.map(p => {
      const pData = [
        p.displayName || "Untitled",
        p.state,
        summarizeAssignments(p.conditions?.users),
        summarizeConditions(p.conditions),
        summarizeGrantControls(p.grantControls)
      ];
      return pData;
    });

    IPC.progress("Rendering audit table...", 90);
    IPC.table(headers, tableRows);
    
    // Store raw data for CSV export via lastTable
    const rawRows = policies.map(p => [
      p.displayName,
      p.state,
      JSON.stringify(p.conditions?.users),
      JSON.stringify(p.conditions),
      JSON.stringify(p.grantControls)
    ]);
    IPC.success({ 
      message: `Audit complete. Found ${policies.length} policies.`,
      table: { headers, rows: rawRows } 
    });
  }
}

TaskRegistry.register(new CaAuditHandler());
