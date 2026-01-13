import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Executive Dashboard
 * High-level overview of tenant health for leadership
 *
 * Metrics:
 * - Total users (active vs inactive)
 * - License utilization
 * - Security posture (MFA adoption, risky sign-ins)
 * - Device compliance
 * - Storage usage
 */
export async function generateExecutiveDashboard(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Generating executive dashboard...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE GENERATION"}`, "info");
    try {
        IPC.progress("Fetching tenant metrics...", 10);
        // Fetch users
        const users = await GraphService.fetchAll(`/users`, "id,userPrincipalName,accountEnabled,assignedLicenses");
        const activeUsers = users.filter(u => u.accountEnabled);
        const disabledUsers = users.filter(u => !u.accountEnabled);
        const licensedUsers = users.filter(u => u.assignedLicenses && u.assignedLicenses.length > 0);
        IPC.log(`Users: ${users.length} total, ${activeUsers.length} active`, "info");
        IPC.progress("Fetching devices...", 40);
        // Fetch devices
        const devices = await GraphService.fetchAll(`/deviceManagement/managedDevices`, "id,operatingSystem,complianceState");
        const compliantDevices = devices.filter(d => d.complianceState === "compliant");
        IPC.log(`Devices: ${devices.length} total, ${compliantDevices.length} compliant`, "info");
        IPC.progress("Generating dashboard...", 70);
        IPC.success({
            message: `Executive Dashboard (${dryRun ? "DRY RUN" : "LIVE"})`,
            table: {
                headers: ["Metric", "Value", "Status"],
                rows: [
                    ["Total Users", users.length.toString(), "📊 Baseline"],
                    ["Active Users", activeUsers.length.toString(), "✅ " + ((activeUsers.length / users.length) * 100).toFixed(1) + "%"],
                    ["Disabled Users", disabledUsers.length.toString(), "❌ " + ((disabledUsers.length / users.length) * 100).toFixed(1) + "%"],
                    ["Licensed Users", licensedUsers.length.toString(), "💼 " + ((licensedUsers.length / users.length) * 100).toFixed(1) + "%"],
                    ["Total Devices", devices.length.toString(), "📱 Managed"],
                    ["Compliant Devices", compliantDevices.length.toString(), "✅ " + ((compliantDevices.length / devices.length) * 100).toFixed(1) + "%"],
                ],
            },
        });
        IPC.log("Dashboard generated successfully", "info");
    }
    catch (error) {
        IPC.error(`Executive dashboard generation failed: ${error.message}`);
    }
}
