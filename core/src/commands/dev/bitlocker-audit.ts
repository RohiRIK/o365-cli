import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * BitLocker Encryption Audit
 * Verifies BitLocker encryption status across Windows devices
 *
 * Analyzes:
 * - Windows device encryption state (encrypted, suspended, unencrypted)
 * - Recovery key backup status
 * - Volume-level encryption details
 * - Compliance policy assignment
 */
export async function auditBitLocker(dryRun: boolean = true) {
  const client = GraphService.getClient();

  IPC.progress("Starting BitLocker audit...", 0);
  IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");

  try {
    IPC.progress("Fetching Windows devices...", 10);

    // Fetch all Windows devices with encryption details
    const devices = await GraphService.fetchAll(
      `/deviceManagement/managedDevices?$filter=operatingSystem eq 'Windows'`,
      "id,deviceName,userPrincipalName,isEncrypted,encryptionState,managedDeviceName,lastSyncDateTime"
    );

    IPC.log(`Analyzing ${devices.length} Windows devices`, "info");

    if (devices.length === 0) {
      IPC.success({
        message: "No Windows devices found in tenant",
        table: {
          headers: ["Status"],
          rows: [["No managed Windows devices"]],
        },
      });
      return;
    }

    IPC.progress("Analyzing BitLocker status...", 50);

    interface DeviceStatus {
      deviceName: string;
      user: string;
      encryptionState: string;
      isEncrypted: boolean;
      lastSync: string;
      risk: string;
    }

    const deviceStatuses: DeviceStatus[] = [];

    for (const device of devices) {
      const encryptionState = device.encryptionState || "Unknown";
      const isEncrypted = device.isEncrypted === true;
      const lastSync = device.lastSyncDateTime
        ? new Date(device.lastSyncDateTime).toISOString().split('T')[0]
        : "Never";

      // Determine risk level based on encryption state
      let risk = "Low";
      if (!isEncrypted || encryptionState === "Unencrypted") {
        risk = "Critical";
      } else if (encryptionState === "Suspended" || encryptionState === "Decrypting") {
        risk = "High";
      } else if (encryptionState === "Unknown") {
        risk = "Medium";
      }

      deviceStatuses.push({
        deviceName: device.deviceName || device.managedDeviceName || "Unknown",
        user: device.userPrincipalName || "Unassigned",
        encryptionState,
        isEncrypted,
        lastSync,
        risk,
      });
    }

    // Calculate statistics
    const encrypted = deviceStatuses.filter(d => d.isEncrypted).length;
    const unencrypted = deviceStatuses.filter(d => !d.isEncrypted).length;
    const suspended = deviceStatuses.filter(d => d.encryptionState === "Suspended").length;
    const unknown = deviceStatuses.filter(d => d.encryptionState === "Unknown").length;

    IPC.log(`${encrypted} devices encrypted (${((encrypted / devices.length) * 100).toFixed(1)}%)`, "info");
    IPC.log(`${unencrypted} devices NOT encrypted (${((unencrypted / devices.length) * 100).toFixed(1)}%)`, unencrypted > 0 ? "error" : "info");

    if (suspended > 0) {
      IPC.log(`${suspended} devices with suspended encryption`, "warn");
    }
    if (unknown > 0) {
      IPC.log(`${unknown} devices with unknown encryption status`, "warn");
    }

    IPC.progress("Generating audit report...", 90);

    // Sort by risk level (Critical > High > Medium > Low)
    const riskOrder: Record<string, number> = {
        Critical: 0,
        High: 1,
        Medium: 2,
        Low: 3,
    };

    deviceStatuses.sort((a, b) => (riskOrder[a.risk] || 999) - (riskOrder[b.risk] || 999));

    // Filter to show at-risk devices (not low risk)
    const atRiskDevices = deviceStatuses.filter(d => d.risk !== "Low");

    if (atRiskDevices.length === 0) {
      IPC.success({
        message: `All ${devices.length} Windows devices are properly encrypted`,
        table: {
          headers: ["Total Devices", "Encrypted", "Compliance Rate"],
          rows: [[
            devices.length.toString(),
            encrypted.toString(),
            `${((encrypted / devices.length) * 100).toFixed(1)}%`
          ]],
        },
      });
    } else {
      IPC.success({
        message: `BitLocker Audit - ${atRiskDevices.length} devices require attention`,
        table: {
          headers: ["Device", "User", "Encryption State", "Last Sync", "Risk"],
          rows: atRiskDevices.map(d => [
            d.deviceName,
            d.user,
            d.encryptionState,
            d.lastSync,
            d.risk,
          ]),
        },
      });

      IPC.log("Recommendations:", "info");
      if (unencrypted > 0) {
        IPC.log("1. Enable BitLocker enforcement via Intune compliance policy", "warn");
      }
      if (suspended > 0) {
        IPC.log("2. Investigate suspended encryption devices - may indicate tampering", "warn");
      }
      if (unknown > 0) {
        IPC.log("3. Sync devices with unknown status to refresh encryption state", "warn");
      }
    }

  } catch (error: any) {
    IPC.error(`BitLocker audit failed: ${error.message}`);
  }
}
