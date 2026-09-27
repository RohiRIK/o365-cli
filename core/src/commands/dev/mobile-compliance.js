import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Mobile Device Hygiene Audit
 * Audits iOS and Android devices for jailbreak/root status, outdated OS versions, and compliance violations
 *
 * Checks:
 * - Jailbreak (iOS) / Root (Android) status
 * - OS version compliance (iOS 15+, Android 12+)
 * - Compliance policy assignment and state
 */
export async function auditMobileCompliance(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting mobile device hygiene audit...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");
    try {
        IPC.progress("Fetching mobile devices from Intune...", 10);
        const devices = await GraphService.fetchAll(`/deviceManagement/managedDevices`, "id,deviceName,operatingSystem,osVersion,complianceState,lastSyncDateTime,userPrincipalName,jailBroken", {
            filter: "operatingSystem eq 'iOS' or operatingSystem eq 'Android'",
        });
        IPC.log(`Found ${devices.length} mobile devices`, "info");
        if (devices.length === 0) {
            IPC.success({
                message: "No mobile devices found in tenant",
                table: {
                    headers: ["Status"],
                    rows: [["No managed mobile devices"]],
                },
            });
            return;
        }
        IPC.progress("Analyzing device hygiene...", 50);
        // Minimum OS version requirements
        const MIN_IOS_VERSION = 15;
        const MIN_ANDROID_VERSION = 12;
        const issues = [];
        for (const device of devices) {
            const deviceName = device.deviceName || "Unknown";
            const user = device.userPrincipalName || "Unassigned";
            const os = device.operatingSystem;
            const osVersion = device.osVersion || "Unknown";
            // Check jailbreak/root status
            if (device.jailBroken === true || device.jailBroken === "True") {
                issues.push({
                    deviceName,
                    user,
                    os,
                    osVersion,
                    issue: os === "iOS" ? "Jailbroken" : "Rooted",
                    severity: "Critical",
                });
            }
            // Check OS version
            if (os === "iOS") {
                const versionMatch = osVersion.match(/^(\d+)/);
                const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;
                if (majorVersion > 0 && majorVersion < MIN_IOS_VERSION) {
                    issues.push({
                        deviceName,
                        user,
                        os,
                        osVersion,
                        issue: `Outdated iOS (< ${MIN_IOS_VERSION})`,
                        severity: "High",
                    });
                }
            }
            else if (os === "Android") {
                const versionMatch = osVersion.match(/^(\d+)/);
                const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;
                if (majorVersion > 0 && majorVersion < MIN_ANDROID_VERSION) {
                    issues.push({
                        deviceName,
                        user,
                        os,
                        osVersion,
                        issue: `Outdated Android (< ${MIN_ANDROID_VERSION})`,
                        severity: "High",
                    });
                }
            }
            // Check compliance state
            if (device.complianceState === "noncompliant") {
                issues.push({
                    deviceName,
                    user,
                    os,
                    osVersion,
                    issue: "Non-compliant",
                    severity: "Medium",
                });
            }
        }
        IPC.log(`${issues.length} hygiene issues found`, issues.length > 0 ? "warn" : "info");
        // Sort by severity (Critical > High > Medium)
        const severityOrder = { "Critical": 0, "High": 1, "Medium": 2 };
        issues.sort((a, b) => (severityOrder[a.severity] || 999) - (severityOrder[b.severity] || 999));
        if (issues.length === 0) {
            IPC.success({
                message: `All ${devices.length} mobile devices pass hygiene checks`,
                table: {
                    headers: ["Total Devices", "iOS", "Android", "Issues"],
                    rows: [[
                            devices.length.toString(),
                            devices.filter(d => d.operatingSystem === "iOS").length.toString(),
                            devices.filter(d => d.operatingSystem === "Android").length.toString(),
                            "0"
                        ]],
                },
            });
        }
        else {
            IPC.success({
                message: `Mobile Device Hygiene Audit - ${issues.length} issues found`,
                table: {
                    headers: ["Device", "User", "OS", "Version", "Issue", "Severity"],
                    rows: issues.map(i => [
                        i.deviceName,
                        i.user,
                        i.os,
                        i.osVersion,
                        i.issue,
                        i.severity,
                    ]),
                },
            });
            IPC.log("Recommendations:", "info");
            const jailbroken = issues.filter(i => i.issue.includes("Jailbroken") || i.issue.includes("Rooted"));
            const outdated = issues.filter(i => i.issue.includes("Outdated"));
            const nonCompliant = issues.filter(i => i.issue === "Non-compliant");
            if (jailbroken.length > 0) {
                IPC.log(`1. Block or wipe ${jailbroken.length} jailbroken/rooted devices immediately`, "error");
            }
            if (outdated.length > 0) {
                IPC.log(`2. Enforce minimum OS version via Intune compliance policy for ${outdated.length} outdated devices`, "warn");
            }
            if (nonCompliant.length > 0) {
                IPC.log(`3. Review and remediate ${nonCompliant.length} non-compliant devices`, "warn");
            }
        }
    }
    catch (error) {
        IPC.error(`Mobile hygiene audit failed: ${error.message}`);
    }
}
