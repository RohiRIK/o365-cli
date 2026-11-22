import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
  parseBooleanFlag,
  parseStringFlag,
} from "../registry";
import { CAPolicyService } from "../../services/ca-policy-service";
import { IPC } from "../../utils/ipc";
import { CABaselineAnalyzer } from "../../services/analyzer/ca-baseline";
import { formatTable } from "../../utils/output";
import chalk from "chalk";
import boxen from "boxen";

export interface CaRoadmapArgs extends TaskArgs {
  exportPath?: string;
  detailed?: boolean; // Show per-policy alignment details
  noMaturity?: boolean; // Skip maturity score in roadmap
}

class CaRoadmapHandler implements TaskHandler {
  taskId = "rep:ca-roadmap";
  name = "360° CA Strategy & Roadmap";
  description = "Generate a prioritized security roadmap with maturity scoring and policy alignment analysis";
  type = "audit" as const;
  status = "beta" as const;

  parseArgs(rawArgs: string[]): CaRoadmapArgs {
    return {
      dryRun: true, // Always read-only
      exportPath: parseStringFlag(rawArgs, "export"),
      detailed: parseBooleanFlag(rawArgs, "detailed"),
      noMaturity: parseBooleanFlag(rawArgs, "no-maturity"),
    };
  }

  validate(_args: CaRoadmapArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: CaRoadmapArgs): Promise<void> {
    IPC.progress("Orchestrating security posture assessment...", 10);

    // Use lightweight policy fetch (no ID resolution needed for analysis)
    const policies = await CAPolicyService.getPolicies();
    
    if (!policies || policies.length === 0) {
      IPC.log("No Conditional Access policies found. Strategic analysis cannot proceed.", "error");
      return;
    }

    // 1. Run Enhanced Analysis (with alignment and conflict detection)
    IPC.progress("Strategizing Zero Trust architecture alignment...", 40);
    const analyzer = new CABaselineAnalyzer();
    const results = analyzer.analyze(policies, { includeConflicts: true });
    const roadmap = analyzer.getRoadmap(results, { includeMaturity: !args.noMaturity });

    // 2. Prepare Analysis Table
    const headers = ["Check", "Status", "Recommendation"];
    const tableRows = results
      .filter(r => r.id !== "report-only-mode") // Strategic note instead
      .map(r => {
        let statusIcon = "";
        let recommendation = r.recommendation;

        if (r.status === "pass") {
            statusIcon = chalk.green("PASS ✅");
            recommendation = chalk.dim("No action needed");
        } else if (r.status === "warn") {
            statusIcon = chalk.yellow("WARN ⚠️");
            recommendation = chalk.yellow("Enable policy (currently Report-Only)");
        } else {
            statusIcon = chalk.red("FAIL ❌");
            recommendation = chalk.yellow(r.recommendation);
        }

        return [
          chalk.bold(r.name),
          statusIcon,
          recommendation
        ];
      });

    // 3. Finalize Output
    IPC.progress("Synthesizing prioritized security roadmap...", 90);
    
    // Clear terminal artifacts
    process.stdout.write("\r\x1b[K"); 

        console.log("\n" + chalk.bold("📋 Best Practice Gap Analysis:"));
        IPC.table(headers, tableRows);
        
        console.log("\n" + boxen(roadmap, {
            padding: 1,
            borderColor: "yellow",
            title: "📍 CA Implementation Roadmap",
            borderStyle: "round"
        }));

        // 3a. Optional: Detailed Policy Alignment Report
        if (args.detailed) {
            console.log("\n" + chalk.bold("📋 Detailed Policy Alignment Report:"));
            const detailedReport = analyzer.getDetailedPolicyReport(results);
            console.log(detailedReport);
        }
    
        // 4. Store for CSV export (silently)
        const exportHeaders = ["ID", "Check Name", "Description", "Status", "Recommendation"];
        const exportRows = results.map(r => [r.id, r.name, r.description, r.status.toUpperCase(), r.recommendation]);
        IPC.setExportTable(exportHeaders, exportRows);
    
        IPC.progress("Report complete", 100);

        // Get maturity score for success message
        const maturityScore = analyzer.getMaturityScore(results);

        IPC.success({
          message: `Strategic roadmap generated based on ${policies.length} analyzed policies. Overall maturity: ${maturityScore.overall}% (${maturityScore.breakdown.passed} passed, ${maturityScore.breakdown.partial} partial, ${maturityScore.breakdown.failed} failed).`,
          roadmap: roadmap // Include roadmap text for export
        });
      }
    }
TaskRegistry.register(new CaRoadmapHandler());
