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
import chalk from "chalk";

export interface CaAuditArgs extends TaskArgs {
  state?: string;
  target?: string;
  exportPath?: string;
}

export async function fetchCAPolicies() {
  return await GraphService.fetchAll("/identity/conditionalAccess/policies");
}

class CaAuditHandler implements TaskHandler {
  taskId = "sec:ca-audit";
  name = "Conditional Access Audit";
  description = "Detailed technical audit of every Conditional Access policy";
  type = "audit" as const;
  status = "prod" as const;

  parseArgs(rawArgs: string[]): CaAuditArgs {
    return {
      // Audit modules are always read-only, no dry-run flag needed
      dryRun: true,
      state: parseStringFlag(rawArgs, "state"),
      target: parseStringFlag(rawArgs, "target"),
      exportPath: parseStringFlag(rawArgs, "export"),
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

        const policies = await auditCAPolicies({ analyze: false, ...args });

        

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

        

        // 2. Prepare UI Table rows (Compact Summary for CLI)

        IPC.progress("Preparing audit table...", 95);    const headers = ["Policy Name", "State", "Assignments", "Conditions", "Grant Controls"];
    const tableRows = policies.map(p => {
      return [
        p.displayName || "Untitled",
        p.state,
        summarizeAssignments(p.conditions?.users),
        summarizeConditions(p.conditions),
        summarizeGrantControls(p.grantControls)
      ];
    });

    // 3. Render Table & Finalize
    IPC.progress("Audit complete", 100);

    // Manual clear of the current spinner line to prevent orphaned progress logs
    process.stdout.write("\r\x1b[K"); 

    console.log("\n" + chalk.bold("📊 Detailed Conditional Access Audit:"));
    IPC.table(headers, tableRows);

    // 4. Store granular flattened data for CSV export (silently)
    const exportHeaders = Object.keys(flattenedData[0] || {});
    const exportRows = flattenedData.map(d => Object.values(d));
    IPC.setExportTable(exportHeaders, exportRows);

    IPC.success({
      message: `Technical audit complete. Found ${policies.length} policies.`
    });
  }
}

TaskRegistry.register(new CaAuditHandler());