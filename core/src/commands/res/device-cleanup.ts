import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * Stale Device Cleanup
 * Removes inactive devices from Intune and Entra ID based on inactivity threshold
 *
 * Analyzes:
 * - Last sync date for managed devices (Intune)
 * - Last sign-in date for Entra registered devices
 * - Device ownership and compliance state
 *
 * IMPORTANT: Defaults to dry-run mode - requires explicit --dry-run false for live deletions
 */
export async function cleanupStaleDevices(inactivityDays: number = 90, dryRun: boolean = true) {
  const client = GraphService.getClient();

  IPC.progress("Starting stale device cleanup...", 0);
  IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE DELETION"}`, dryRun ? "info" : "warn");
  IPC.log(`Inactivity threshold: ${inactivityDays} days`, "info");

  if (!dryRun) {
    IPC.log("WARNING: Live deletion mode - devices will be permanently removed!", "error");
  }

  try {
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - inactivityDays * 24 * 60 * 60 * 1000);

    // Step 1: Get all managed devices from Intune
    IPC.progress("Fetching managed devices from Intune...", 10);

    const managedDevices = await GraphService.fetchAll(
      `/deviceManagement/managedDevices`,
      "id,deviceName,userPrincipalName,operatingSystem,lastSyncDateTime,complianceState,managedDeviceOwnerType"
    );

    IPC.log(`Found ${managedDevices.length} managed devices`, "info");

    // Step 2: Identify stale managed devices
    IPC.progress("Identifying stale managed devices...", 30);

    interface StaleDevice {
      id: string;
      name: string;
      user: string;
      os: string;
      lastSync: string;
      daysSinceSync: number;
      type: string;
      complianceState: string;
    }

    const staleManagedDevices: StaleDevice[] = [];

    for (const device of managedDevices) {
      if (device.lastSyncDateTime) {
        const lastSync = new Date(device.lastSyncDateTime);
        const daysSinceSync = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceSync > inactivityDays) {
          staleManagedDevices.push({
            id: device.id,
            name: device.deviceName || "Unknown",
            user: device.userPrincipalName || "Unassigned",
            os: device.operatingSystem || "Unknown",
            lastSync: lastSync.toISOString().split('T')[0],
            daysSinceSync,
            type: "Managed (Intune)",
            complianceState: device.complianceState || "Unknown",
          });
        }
      }
    }

    IPC.log(`${staleManagedDevices.length} stale managed devices (>${inactivityDays} days)`, staleManagedDevices.length > 0 ? "warn" : "info");

    // Step 3: Get all Entra registered devices
    IPC.progress("Fetching Entra registered devices...", 50);

    const entraDevices = await GraphService.fetchAll(
      `/devices`,
      "id,displayName,operatingSystem,approximateLastSignInDateTime,accountEnabled"
    );

    IPC.log(`Found ${entraDevices.length} Entra registered devices`, "info");

    // Step 4: Identify stale Entra devices
    IPC.progress("Identifying stale Entra devices...", 70);

    const staleEntraDevices: StaleDevice[] = [];

    for (const device of entraDevices) {
      if (device.approximateLastSignInDateTime) {
        const lastSignIn = new Date(device.approximateLastSignInDateTime);
        const daysSinceSignIn = Math.floor((now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceSignIn > inactivityDays) {
          staleEntraDevices.push({
            id: device.id,
            name: device.displayName || "Unknown",
            user: "N/A",
            os: device.operatingSystem || "Unknown",
            lastSync: lastSignIn.toISOString().split('T')[0],
            daysSinceSync: daysSinceSignIn,
            type: "Entra Registered",
            complianceState: device.accountEnabled ? "Enabled" : "Disabled",
          });
        }
      }
    }

    IPC.log(`${staleEntraDevices.length} stale Entra devices (>${inactivityDays} days)`, staleEntraDevices.length > 0 ? "warn" : "info");

    const allStaleDevices = [...staleManagedDevices, ...staleEntraDevices];

    if (allStaleDevices.length === 0) {
      IPC.success({
        message: `No stale devices found (>${inactivityDays} days inactive)`,
        table: {
          headers: ["Total Devices", "Managed", "Entra", "Stale"],
          rows: [[
            (managedDevices.length + entraDevices.length).toString(),
            managedDevices.length.toString(),
            entraDevices.length.toString(),
            "0"
          ]],
        },
      });
      return;
    }

    // Sort by days since last activity (oldest first)
    allStaleDevices.sort((a, b) => b.daysSinceSync - a.daysSinceSync);

    if (dryRun) {
      IPC.success({
        message: `Stale Device Cleanup (DRY RUN) - ${allStaleDevices.length} devices would be deleted`,
        table: {
          headers: ["Device", "User", "OS", "Last Activity", "Days Inactive", "Type"],
          rows: allStaleDevices.map(d => [
            d.name,
            d.user,
            d.os,
            d.lastSync,
            d.daysSinceSync.toString(),
            d.type,
          ]),
        },
      });

      IPC.log("DRY RUN: No devices were deleted. Use --dry-run false to execute deletions.", "warn");
      IPC.log("Recommendations:", "info");
      IPC.log("1. Review the list of stale devices before proceeding", "info");
      IPC.log("2. Verify users are aware of pending device removal", "info");
      IPC.log("3. Run with --dry-run false to execute cleanup", "info");

    } else {
      // LIVE DELETION MODE
      IPC.progress("Deleting stale devices (LIVE)...", 80);

      let deletedCount = 0;
      let failedCount = 0;

      for (const device of allStaleDevices) {
        try {
          if (device.type === "Managed (Intune)") {
            await client.api(`/deviceManagement/managedDevices/${device.id}`).delete();
          } else {
            await client.api(`/devices/${device.id}`).delete();
          }

          deletedCount++;
          IPC.log(`Deleted: ${device.name} (${device.daysSinceSync} days inactive)`, "info");

        } catch (error: any) {
          failedCount++;
          IPC.log(`Failed to delete ${device.name}: ${error.message}`, "error");
        }
      }

      IPC.success({
        message: `Stale Device Cleanup Complete`,
        table: {
          headers: ["Total Stale", "Deleted", "Failed"],
          rows: [[
            allStaleDevices.length.toString(),
            deletedCount.toString(),
            failedCount.toString(),
          ]],
        },
      });

      IPC.log(`Deleted ${deletedCount} stale devices`, "info");
      if (failedCount > 0) {
        IPC.log(`Failed to delete ${failedCount} devices`, "error");
      }

      IPC.log("Next steps:", "info");
      IPC.log("1. Review audit logs for deleted devices", "info");
      IPC.log("2. Notify users of device removal if needed", "info");
      IPC.log("3. Update device inventory records", "info");
    }

  } catch (error: any) {
    IPC.error(`Stale device cleanup failed: ${error.message}`);
  }
}
