import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * Device Encryption Status Audit
 * Verifies encryption status (BitLocker, FileVault) across all managed devices
 */
export async function auditDeviceEncryption(dryRun: boolean = true) {
  const client = GraphService.getClient();

  IPC.progress("Starting device encryption audit...", 0);
  IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");

  try {
    IPC.progress("Fetching managed devices...", 10);

    const devices = await GraphService.fetchAll(
      `/deviceManagement/managedDevices`,
      "id,deviceName,operatingSystem,osVersion,isEncrypted,userPrincipalName"
    );

    IPC.log(`Analyzing ${devices.length} managed devices`, "info");

    IPC.progress("Analyzing encryption status...", 50);

    const encrypted = devices.filter(d => d.isEncrypted === true);
    const unencrypted = devices.filter(d => d.isEncrypted === false);
    const unknown = devices.filter(d => d.isEncrypted === undefined || d.isEncrypted === null);

    IPC.log(`${encrypted.length} devices encrypted`, "info");
    IPC.log(`${unencrypted.length} devices NOT encrypted`, unencrypted.length > 0 ? "error" : "info");
    IPC.log(`${unknown.length} devices with unknown encryption status`, unknown.length > 0 ? "warn" : "info");

    IPC.success({
      message: `Device Encryption Audit (${dryRun ? "DRY RUN" : "LIVE"})`,
      table: {
        headers: ["Status", "Device Count", "Percentage"],
        rows: [
          ["✅ Encrypted", encrypted.length.toString(), ((encrypted.length / devices.length) * 100).toFixed(1) + "%"],
          ["❌ Not Encrypted", unencrypted.length.toString(), ((unencrypted.length / devices.length) * 100).toFixed(1) + "%"],
          ["❓ Unknown", unknown.length.toString(), ((unknown.length / devices.length) * 100).toFixed(1) + "%"],
        ],
      },
    });

    if (unencrypted.length > 0) {
      IPC.log("Recommendation: Enable BitLocker/FileVault enforcement via Intune policy", "warn");
    }

  } catch (error: any) {
    IPC.error(`Device encryption audit failed: ${error.message}`);
  }
}
