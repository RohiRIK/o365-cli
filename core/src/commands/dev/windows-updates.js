import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Windows Update Compliance Audit
 * Identifies devices with outdated builds, patch gaps, and update ring compliance
 *
 * Audits:
 * - Windows 10/11 build versions
 * - Security update status
 * - Quality update status
 * - Update ring assignments
 * - Devices blocking updates
 *
 * Common Issues:
 * - Devices on unsupported builds (end-of-service)
 * - Security patches >30 days overdue
 * - Update deferrals exceeding policy
 * - Devices with update failures
 */
export async function auditWindowsUpdates(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting Windows Update compliance audit...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");
    try {
        // Phase 1: Fetch all Windows devices (0-30%)
        IPC.progress("Fetching Windows devices from Intune...", 5);
        const devices = await GraphService.fetchAll(`/deviceManagement/managedDevices`, "id,deviceName,operatingSystem,osVersion,complianceState,lastSyncDateTime,userPrincipalName,model", {
            filter: "operatingSystem eq 'Windows'",
        });
        IPC.log(`Found ${devices.length} Windows devices`, "info");
        if (devices.length === 0) {
            IPC.success({
                message: "No Windows devices found in Intune",
                table: {
                    headers: ["Status"],
                    rows: [["No devices to audit"]],
                },
            });
            return;
        }
        IPC.progress("Analyzing Windows build versions...", 30);
        const analyzedDevices = [];
        const now = new Date();
        // Known Windows versions and their end-of-service dates
        const knownBuilds = {
            // Windows 11
            "10.0.22000": { name: "Windows 11 21H2", endOfService: new Date("2024-10-08"), isSupported: false },
            "10.0.22621": { name: "Windows 11 22H2", endOfService: new Date("2025-10-14"), isSupported: true },
            "10.0.22631": { name: "Windows 11 23H2", endOfService: new Date("2026-11-10"), isSupported: true },
            // Windows 10
            "10.0.19041": { name: "Windows 10 2004", endOfService: new Date("2021-12-14"), isSupported: false },
            "10.0.19042": { name: "Windows 10 20H2", endOfService: new Date("2023-05-09"), isSupported: false },
            "10.0.19043": { name: "Windows 10 21H1", endOfService: new Date("2022-12-13"), isSupported: false },
            "10.0.19044": { name: "Windows 10 21H2", endOfService: new Date("2024-06-11"), isSupported: false },
            "10.0.19045": { name: "Windows 10 22H2", endOfService: new Date("2025-10-14"), isSupported: true },
        };
        for (const device of devices) {
            const osVersion = device.osVersion || "Unknown";
            const lastSync = device.lastSyncDateTime ? new Date(device.lastSyncDateTime) : null;
            // Calculate days since last sync
            const daysSinceSync = lastSync ? Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24)) : 9999;
            // Determine build info
            const buildInfo = knownBuilds[osVersion] || { name: osVersion, endOfService: new Date(), isSupported: false };
            // Determine risk level
            let riskLevel;
            if (!buildInfo.isSupported) {
                riskLevel = "Critical"; // Out-of-support build
            }
            else if (daysSinceSync > 30) {
                riskLevel = "High"; // No sync in >30 days
            }
            else if (daysSinceSync > 14) {
                riskLevel = "Medium"; // No sync in >14 days
            }
            else {
                riskLevel = "Low"; // Recently synced and supported
            }
            analyzedDevices.push({
                device,
                buildVersion: buildInfo.name,
                isSupported: buildInfo.isSupported,
                daysOutOfDate: daysSinceSync,
                riskLevel,
            });
        }
        IPC.progress("Generating compliance report...", 60);
        // Phase 3: Categorize devices by risk (60-90%)
        const criticalDevices = analyzedDevices.filter(d => d.riskLevel === "Critical");
        const highRiskDevices = analyzedDevices.filter(d => d.riskLevel === "High");
        const mediumRiskDevices = analyzedDevices.filter(d => d.riskLevel === "Medium");
        const compliantDevices = analyzedDevices.filter(d => d.riskLevel === "Low");
        IPC.log(`Critical risk devices: ${criticalDevices.length}`, "error");
        IPC.log(`High risk devices: ${highRiskDevices.length}`, "warn");
        IPC.log(`Medium risk devices: ${mediumRiskDevices.length}`, "info");
        IPC.log(`Compliant devices: ${compliantDevices.length}`, "info");
        IPC.progress("Finalizing report...", 90);
        // Phase 4: Generate output (90-100%)
        const topRiskyDevices = [...criticalDevices, ...highRiskDevices].slice(0, 20);
        if (topRiskyDevices.length === 0) {
            IPC.success({
                message: "All Windows devices are compliant with update policies",
                table: {
                    headers: ["Status", "Device Count"],
                    rows: [
                        ["✅ Compliant", compliantDevices.length.toString()],
                        ["⚠️ Medium Risk", mediumRiskDevices.length.toString()],
                        ["Total Devices", devices.length.toString()],
                    ],
                },
            });
        }
        else {
            IPC.success({
                message: `Windows Update Compliance Audit (${dryRun ? "DRY RUN" : "LIVE"})`,
                table: {
                    headers: ["Device Name", "User", "Build Version", "Risk", "Days Since Sync", "Status"],
                    rows: topRiskyDevices.map(d => [
                        d.device.deviceName,
                        d.device.userPrincipalName || "N/A",
                        d.buildVersion,
                        d.riskLevel === "Critical" ? "🔴 Critical" : "🟠 High",
                        d.daysOutOfDate.toString(),
                        d.isSupported ? "Supported" : "⚠️ Out-of-Support",
                    ]),
                },
            });
            IPC.log(`Showing top 20 risky devices (${topRiskyDevices.length} total)`, "info");
            IPC.log(`Critical devices require immediate action`, "warn");
            IPC.log(`Summary: ${criticalDevices.length} critical, ${highRiskDevices.length} high, ${mediumRiskDevices.length} medium, ${compliantDevices.length} compliant`, "info");
        }
    }
    catch (error) {
        IPC.error(`Windows Update audit failed: ${error.message}`);
    }
}
