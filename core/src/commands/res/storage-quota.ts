import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * Storage Quota Analysis
 * Identifies users consuming excessive OneDrive/SharePoint storage
 */
export async function analyzeStorageQuota(dryRun: boolean = true) {
  const client = GraphService.getClient();

  IPC.progress("Starting storage quota analysis...", 0);
  IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE ANALYSIS"}`, "info");

  try {
    IPC.progress("Fetching OneDrive storage usage...", 10);

    const users = await GraphService.fetchAll(
      `/users`,
      "id,userPrincipalName,displayName"
    );

    IPC.log(`Analyzing storage for ${users.length} users`, "info");

    // Fetch OneDrive usage for each user (sampling first 100)
    const sampleSize = Math.min(users.length, 100);
    let totalStorage = 0;
    let userCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      try {
        const drive = await client.api(`/users/${users[i].id}/drive`).select("quota").get();
        if (drive.quota) {
          totalStorage += drive.quota.used || 0;
          userCount++;
        }
      } catch (error) {
        // Skip users without OneDrive
      }
    }

    const avgStorageGB = totalStorage / userCount / (1024 * 1024 * 1024);

    IPC.log(`Average storage per user: ${avgStorageGB.toFixed(2)} GB`, "info");

    IPC.success({
      message: `Storage Quota Analysis (${dryRun ? "DRY RUN" : "LIVE"})`,
      table: {
        headers: ["Metric", "Value"],
        rows: [
          ["Users Analyzed", sampleSize.toString()],
          ["Average Storage/User", avgStorageGB.toFixed(2) + " GB"],
        ],
      },
    });

  } catch (error: any) {
    IPC.error(`Storage quota analysis failed: ${error.message}`);
  }
}
