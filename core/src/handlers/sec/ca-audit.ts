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
import { CABaselineAnalyzer } from "../../services/analyzer/ca-baseline";
import { formatTable } from "../../utils/output";
import chalk from "chalk";

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

    // 1. Analysis (if requested)
    let analysisTable = "";
    if (args.analyze) {
      IPC.progress("Running Best Practice Analysis...", 20);
      const analyzer = new CABaselineAnalyzer();
      const results = analyzer.analyze(policies);
      
      const analysisHeaders = ["Check", "Status", "Recommendation"];
      const analysisRows = results.map(r => {
        const statusIcon = r.status === "pass" ? chalk.green("PASS ✅") : chalk.red("FAIL ❌");
        return [
          chalk.bold(r.name),
          statusIcon,
          r.status === "fail" ? chalk.yellow(r.recommendation) : chalk.dim("No action needed")
        ];
      });
      analysisTable = "\n" + chalk.bold("📋 Best Practice Gap Analysis:") + "\n" + formatTable(analysisHeaders, analysisRows);
    }

    // 2. Resolve names for CSV export
    const flattenedData: any[] = [];
    for (let i = 0; i < policies.length; i++) {
      const p = policies[i];
      const progress = 30 + Math.floor((i / policies.length) * 60);
      IPC.progress(`Resolving identities: ${p.displayName || "policy"}...`, progress);
      flattenedData.push(await flattenPolicyForExport(p));
    }
    
    // 3. Prepare UI Table rows (Compact Summary for CLI)
    IPC.progress("Preparing audit table...", 95);
    const headers = ["Policy Name", "State", "Assignments", "Conditions", "Grant Controls"];
    const tableRows = policies.map(p => {
      return [
        p.displayName || "Untitled",
        p.state,
        summarizeAssignments(p.conditions?.users),
        summarizeConditions(p.conditions),
        summarizeGrantControls(p.grantControls)
      ];
    });

    // 4. Render & Finalize
    IPC.progress("Audit complete", 100);
    
    // Manual clear of the current spinner line
    process.stdout.write("\r\x1b[K"); 
    
    if (analysisTable) console.log(analysisTable);
    
    console.log("\n" + chalk.bold("📊 Detailed Policy Audit:"));
    IPC.table(headers, tableRows);
    
    // Store granular flattened data for CSV export (silently)
    const exportHeaders = Object.keys(flattenedData[0] || {});
    const exportRows = flattenedData.map(d => Object.values(d));
    IPC.setExportTable(exportHeaders, exportRows);

    IPC.success({ 
      message: `Audit complete. Found ${policies.length} policies.`
    });
  }
}

TaskRegistry.register(new CaAuditHandler());

