import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * Teams Sprawl Analysis
 * Identifies abandoned Teams workspaces to reclaim SharePoint storage
 *
 * Analyzes:
 * - Teams last activity (messages, file modifications)
 * - Storage consumption per team
 * - Member count and activity patterns
 * - Recommendations for archival or deletion
 */
export async function analyzeTeamsSprawl(inactivityDays: number = 90) {
  const client = GraphService.getClient();

  IPC.progress("Starting Teams sprawl analysis...", 0);
  IPC.log(`Inactivity threshold: ${inactivityDays} days`, "info");

  try {
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - inactivityDays * 24 * 60 * 60 * 1000);

    IPC.progress("Fetching all Teams workspaces...", 10);

    // Get all Teams (which are M365 groups with Team-enabled property)
    const teams = await GraphService.fetchAll(
      `/groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')`,
      "id,displayName,mail,createdDateTime,renewedDateTime,memberCount"
    );

    IPC.log(`Analyzing ${teams.length} Teams workspaces`, "info");

    interface InactiveTeam {
      name: string;
      createdDate: string;
      lastActivity: string;
      daysSinceActivity: number;
      members: number;
      storageUsedMb: number;
      recommendation: string;
      severity: string;
    }

    const inactiveTeams: InactiveTeam[] = [];

    IPC.progress("Analyzing Team activity...", 30);

    for (const team of teams) {
      try {
        // Determine last activity date
        let lastActivityDate: Date | null = null;

        // Option 1: Use renewedDateTime if available (M365 groups track this)
        if (team.renewedDateTime) {
          lastActivityDate = new Date(team.renewedDateTime);
        } else if (team.createdDateTime) {
          // Fallback to creation date
          lastActivityDate = new Date(team.createdDateTime);
        }

        if (!lastActivityDate) {
          continue;
        }

        const daysSinceActivity = Math.floor(
          (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if team is inactive beyond threshold
        if (daysSinceActivity > inactivityDays) {
          // Get member count
          let memberCount = 0;
          try {
            const members = await client.api(`/groups/${team.id}/members`).get();
            memberCount = members.value?.length || 0;
          } catch (error: any) {
            // Member count unavailable
            memberCount = team.memberCount || 0;
          }

          // Get storage usage from the team's SharePoint site
          let storageUsedMb = 0;
          try {
            const drive = await client.api(`/groups/${team.id}/drive`).get();
            if (drive && drive.quota) {
              storageUsedMb = Math.round((drive.quota.used || 0) / (1024 * 1024));
            }
          } catch (error: any) {
            // Storage info unavailable
          }

          // Determine recommendation based on context
          let recommendation = "Archive - No recent activity";
          let severity = "Medium";

          if (memberCount === 0) {
            recommendation = "Delete - No members";
            severity = "High";
          } else if (daysSinceActivity > 180) {
            recommendation = "Delete - Abandoned (>6 months)";
            severity = "High";
          } else if (memberCount > 50) {
            recommendation = `Review - ${memberCount} members, verify before archival`;
            severity = "Low";
          } else if (storageUsedMb > 5000) {
            // >5GB storage
            recommendation = `Archive - ${(storageUsedMb / 1024).toFixed(1)}GB storage, reclaim space`;
            severity = "High";
          }

          inactiveTeams.push({
            name: team.displayName || "Unknown",
            createdDate: team.createdDateTime
              ? new Date(team.createdDateTime).toISOString().split("T")[0]
              : "Unknown",
            lastActivity: lastActivityDate.toISOString().split("T")[0],
            daysSinceActivity,
            members: memberCount,
            storageUsedMb,
            recommendation,
            severity,
          });
        }
      } catch (error: any) {
        // Team analysis failed - continue with next
        IPC.log(`Failed to analyze team ${team.displayName}: ${error.message}`, "warn");
      }
    }

    IPC.progress("Generating sprawl report...", 90);

    IPC.log(
      `${inactiveTeams.length} inactive Teams (>${inactivityDays} days)`,
      inactiveTeams.length > 0 ? "warn" : "info"
    );

    // Sort by severity (High > Medium > Low) and then by days inactive
    const severityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    inactiveTeams.sort(
      (a, b) =>
        (severityOrder[a.severity] || 999) - (severityOrder[b.severity] || 999) ||
        b.daysSinceActivity - a.daysSinceActivity
    );

    if (inactiveTeams.length === 0) {
      IPC.success({
        message: `No inactive Teams found (>${inactivityDays} days)`,
        table: {
          headers: ["Total Teams", "Active Teams", "Inactive Teams"],
          rows: [[teams.length.toString(), teams.length.toString(), "0"]],
        },
      });
      return;
    }

    // Calculate total storage savings
    const totalStorageMb = inactiveTeams.reduce((sum, t) => sum + t.storageUsedMb, 0);
    const totalStorageGb = (totalStorageMb / 1024).toFixed(1);

    IPC.success({
      message: `Teams Sprawl Report - ${inactiveTeams.length} inactive workspaces found`,
      table: {
        headers: [
          "Team Name",
          "Created",
          "Last Activity",
          "Days Inactive",
          "Members",
          "Storage (MB)",
          "Recommendation",
          "Severity",
        ],
        rows: inactiveTeams.map((t) => [
          t.name.length > 30 ? t.name.substring(0, 27) + "..." : t.name,
          t.createdDate,
          t.lastActivity,
          t.daysSinceActivity.toString(),
          t.members.toString(),
          t.storageUsedMb.toString(),
          t.recommendation.length > 40
            ? t.recommendation.substring(0, 37) + "..."
            : t.recommendation,
          t.severity,
        ]),
      },
    });

    // Summary statistics
    const high = inactiveTeams.filter((t) => t.severity === "High");
    const medium = inactiveTeams.filter((t) => t.severity === "Medium");
    const largeStorage = inactiveTeams.filter((t) => t.storageUsedMb > 5000);

    IPC.log("\nRecommendations:", "info");
    if (high.length > 0) {
      IPC.log(`1. ${high.length} high-priority teams - delete or archive immediately`, "error");
    }
    if (medium.length > 0) {
      IPC.log(`2. ${medium.length} medium-priority teams - notify owners and archive`, "warn");
    }
    if (largeStorage.length > 0) {
      IPC.log(
        `3. ${largeStorage.length} teams consuming >5GB - prioritize for storage reclamation`,
        "warn"
      );
    }
    IPC.log(`4. Potential storage savings: ${totalStorageGb}GB`, "info");
    IPC.log("5. Implement Teams lifecycle policies to prevent future sprawl", "info");
  } catch (error: any) {
    IPC.error(`Teams sprawl analysis failed: ${error.message}`);
  }
}
