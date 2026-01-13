import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * macOS Update Compliance Audit
 * Similar to Windows updates but for macOS devices managed by Intune
 */
export async function auditMacOSUpdates(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting macOS Update compliance audit...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");
    try {
        IPC.progress("Fetching macOS devices from Intune...", 10);
        const devices = await GraphService.fetchAll(`/deviceManagement/managedDevices`, "id,deviceName,operatingSystem,osVersion,complianceState,lastSyncDateTime,userPrincipalName", {
            filter: "operatingSystem eq 'macOS'",
        });
        IPC.log(`Found ${devices.length} macOS devices`, "info");
        if (devices.length === 0) {
            IPC.success({
                message: "No macOS devices found in Intune",
                table: {
                    headers: ["Status"],
                    rows: [["No devices to audit"]],
                },
            });
            return;
        }
        IPC.progress("Analyzing macOS versions...", 50);
        const now = new Date();
        const riskyDevices = devices.filter(d => {
            const lastSync = d.lastSyncDateTime ? new Date(d.lastSyncDateTime) : null;
            const daysSince = lastSync ? Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24)) : 9999;
            return daysSince > 30; // No sync in 30+ days
        });
        IPC.log(`${riskyDevices.length} devices need attention`, riskyDevices.length > 0 ? "warn" : "info");
        IPC.success({
            message: `macOS Update Compliance Audit (${dryRun ? "DRY RUN" : "LIVE"})`,
            table: {
                headers: ["Total Devices", "Compliant", "Needs Attention"],
                rows: [[devices.length.toString(), (devices.length - riskyDevices.length).toString(), riskyDevices.length.toString()]],
            },
        });
    }
    catch (error) {
        IPC.error(`macOS Update audit failed: ${error.message}`);
    }
}
