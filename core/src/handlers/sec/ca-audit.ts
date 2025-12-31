import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseStringFlag,
} from "../registry";
import { GraphService } from "../../services/graph";
import { 
  auditCAPolicies, 
  renderCAPoliciesTable,
  summarizeAssignments,
  summarizeConditions,
  summarizeGrantControls,
  flattenPolicyForExport
} from "../../commands/sec/ca-audit";
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

    // 1. Resolve names for CSV export with granular progress
    const flattenedData: any[] = [];
    for (let i = 0; i < policies.length; i++) {
      const p = policies[i];
      const progress = 10 + Math.floor((i / policies.length) * 80);
      IPC.progress(`Resolving identities: ${p.displayName || "policy"}...`, progress);
      flattenedData.push(await flattenPolicyForExport(p));
    }
    
    // 2. Prepare UI Table rows
    IPC.progress("Preparing audit table...", 80);
    const headers = ["Policy Name", "State", "Assignments", "Conditions", "Grant Controls"];
    const tableRows = await Promise.all(policies.map(async p => {
      return [
        p.displayName || "Untitled",
        p.state,
        await summarizeAssignments(p.conditions?.users, 2), // Resolved names
        await summarizeConditions(p.conditions, 2),       // Resolved names
        summarizeGrantControls(p.grantControls)
      ];
    }));

    // 3. Render Table & Finalize
    IPC.progress("Audit complete", 100);
    
    // Manual clear of the current spinner line to prevent orphaned progress logs
    process.stdout.write("\r\x1b[K"); 
    
    IPC.table(headers, tableRows);
    
    // 4. Store granular flattened data for CSV export (silently)
    const exportHeaders = Object.keys(flattenedData[0] || {});
    const exportRows = flattenedData.map(d => Object.values(d));
    IPC.setExportTable(exportHeaders, exportRows);

    IPC.success({ 
      message: `Audit complete. Found ${policies.length} policies.`
    });
  }
}

TaskRegistry.register(new CaAuditHandler());
