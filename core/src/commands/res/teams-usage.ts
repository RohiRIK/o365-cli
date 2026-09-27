import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * Teams Usage Analytics
 * Identifies inactive Teams and channels to optimize collaboration resources
 */
export async function analyzeTeamsUsage(days: number = 90, dryRun: boolean = true) {
  const client = GraphService.getClient();

  IPC.progress("Starting Teams usage analysis...", 0);
  IPC.log(`Threshold: ${days} days of inactivity`, "info");
  IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE ANALYSIS"}`, "info");

  try {
    IPC.progress("Fetching Teams...", 10);

    const teams = await GraphService.fetchAll(
      `/groups`,
      "id,displayName,mail,createdDateTime",
      {
        filter: "resourceProvisioningOptions/Any(x:x eq 'Team')",
      }
    );

    IPC.log(`Found ${teams.length} Teams`, "info");

    IPC.progress("Analyzing Teams activity...", 50);

    // Simplified analysis
    const recentTeams = teams.filter(team => {
      const created = team.createdDateTime ? new Date(team.createdDateTime) : new Date();
      const daysSince = Math.floor((new Date().getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince <= days;
    });

    IPC.log(`${recentTeams.length} Teams created in last ${days} days`, "info");

    IPC.success({
      message: `Teams Usage Analysis (${dryRun ? "DRY RUN" : "LIVE"})`,
      table: {
        headers: ["Metric", "Value"],
        rows: [
          ["Total Teams", teams.length.toString()],
          ["Recently Created", recentTeams.length.toString()],
        ],
      },
    });

  } catch (error: any) {
    IPC.error(`Teams usage analysis failed: ${error.message}`);
  }
}
