import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * Stale Device Detection
 * Identifies devices that haven't synced with Intune in extended periods
 */
export async function detectStaleDevices(days: number = 90, dryRun: boolean = true) {
  const client = GraphService.getClient();

  IPC.progress("Starting stale device detection...", 0);
  IPC.log(`Threshold: ${days} days of inactivity`, "info");
  IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE DETECTION"}`, "info");

  try {
    IPC.progress("Fetching managed devices...", 10);

    const devices = await GraphService.fetchAll(
      `/deviceManagement/managedDevices`,
      "id,deviceName,operatingSystem,osVersion,lastSyncDateTime,userPrincipalName,complianceState"
    );

    IPC.log(`Analyzing ${devices.length} managed devices`, "info");

    IPC.progress("Identifying stale devices...", 50);

    const now = new Date();
    const staleDevices = devices.filter(d => {
      const lastSync = d.lastSyncDateTime ? new Date(d.lastSyncDateTime) : null;
      if (!lastSync) return true; // Never synced

      const daysSince = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince > days;
    });

    IPC.log(`Found ${staleDevices.length} stale devices`, staleDevices.length > 0 ? "warn" : "info");

    if (staleDevices.length === 0) {
      IPC.success({
        message: `No stale devices found (threshold: ${days} days)`,
        table: {
          headers: ["Status"],
          rows: [["All devices are syncing regularly"]],
        },
      });
    } else {
      const topDevices = staleDevices.slice(0, 20);

      IPC.success({
        message: `Stale Device Report (${dryRun ? "DRY RUN" : "LIVE"})`,
        table: {
          headers: ["Device Name", "OS", "User", "Last Sync", "Recommendation"],
          rows: topDevices.map(d => {
            const lastSync = d.lastSyncDateTime ? new Date(d.lastSyncDateTime) : null;
            const daysSince = lastSync ? Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24)) : 9999;

            return [
              d.deviceName,
              d.operatingSystem,
              d.userPrincipalName || "N/A",
              lastSync ? lastSync.toLocaleDateString() : "Never",
              daysSince > 180 ? "Retire device" : "Contact user",
            ];
          }),
        },
      });

      IPC.log(`Showing top 20 stale devices (${staleDevices.length} total)`, "info");
      IPC.log("Recommendation: Retire devices not synced in >180 days", "warn");
    }

  } catch (error: any) {
    IPC.error(`Stale device detection failed: ${error.message}`);
  }
}
