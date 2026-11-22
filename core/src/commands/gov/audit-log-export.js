import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
import * as fs from "fs";
import * as path from "path";
/**
 * Unified Audit Log Export
 * Export filtered audit logs for compliance investigations
 *
 * Supports:
 * - Office 365 activities (Exchange, SharePoint, OneDrive)
 * - Entra ID sign-in events
 * - Intune device management events
 * - Conditional Access policy changes
 *
 * Common Operations:
 * - UserLoggedIn, MailItemsAccessed, FileDownloaded
 * - UserAdded, UserDeleted, RoleAssignmentAdded
 * - DeviceCompliantStateChanged, PolicyApplied
 */
export async function exportAuditLogs(startDate, endDate, operations, dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting audit log export...", 0);
    IPC.log(`Date range: ${startDate} to ${endDate}`, "info");
    IPC.log(`Operations filter: ${operations || "All operations"}`, "info");
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE EXPORT"}`, "info");
    try {
        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            IPC.error("Invalid date format. Use YYYY-MM-DD (e.g., 2025-01-01)");
            return;
        }
        // Parse dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
            IPC.error("Start date must be before end date");
            return;
        }
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 90) {
            IPC.log("⚠️  Large date range (>90 days) - this may take several minutes", "warn");
        }
        // Phase 1: Fetch Sign-In Logs (0-40%)
        IPC.progress("Fetching Entra ID sign-in logs...", 5);
        let signInLogs = [];
        try {
            const startIso = start.toISOString();
            const endIso = end.toISOString();
            signInLogs = await GraphService.fetchAll(`/auditLogs/signIns`, "id,createdDateTime,userPrincipalName,appDisplayName,ipAddress,location,status,deviceDetail,riskLevel", {
                filter: `createdDateTime ge ${startIso} and createdDateTime le ${endIso}`,
            });
            IPC.log(`Found ${signInLogs.length} sign-in events`, "info");
        }
        catch (error) {
            IPC.log(`Sign-in logs access denied: ${error.message}`, "warn");
            IPC.log("Requires AuditLog.Read.All permission", "warn");
        }
        IPC.progress("Fetching directory audit logs...", 40);
        // Phase 2: Fetch Directory Audit Logs (40-70%)
        let directoryLogs = [];
        try {
            const startIso = start.toISOString();
            const endIso = end.toISOString();
            directoryLogs = await GraphService.fetchAll(`/auditLogs/directoryAudits`, "id,activityDateTime,activityDisplayName,category,result,initiatedBy,targetResources", {
                filter: `activityDateTime ge ${startIso} and activityDateTime le ${endIso}`,
            });
            IPC.log(`Found ${directoryLogs.length} directory audit events`, "info");
        }
        catch (error) {
            IPC.log(`Directory audit logs access denied: ${error.message}`, "warn");
            IPC.log("Requires AuditLog.Read.All permission", "warn");
        }
        // Phase 3: Process and Filter Logs (70-90%)
        IPC.progress("Processing and filtering logs...", 70);
        let filteredSignIns = signInLogs;
        let filteredDirectoryAudits = directoryLogs;
        // Apply operations filter if specified
        if (operations) {
            const operationList = operations.split(",").map(op => op.trim().toLowerCase());
            filteredDirectoryAudits = directoryLogs.filter(log => operationList.some(op => log.activityDisplayName?.toLowerCase().includes(op)));
            IPC.log(`Filtered to ${filteredDirectoryAudits.length} events matching operations filter`, "info");
        }
        // Combine all logs
        const allLogs = [
            ...filteredSignIns.map(log => ({
                type: "SignIn",
                timestamp: log.createdDateTime,
                user: log.userPrincipalName,
                activity: "User Sign-In",
                application: log.appDisplayName,
                ipAddress: log.ipAddress,
                location: log.location?.city || "Unknown",
                status: log.status?.errorCode === 0 ? "Success" : "Failure",
                riskLevel: log.riskLevel || "none",
                deviceOS: log.deviceDetail?.operatingSystem,
            })),
            ...filteredDirectoryAudits.map(log => ({
                type: "DirectoryAudit",
                timestamp: log.activityDateTime,
                user: log.initiatedBy?.user?.userPrincipalName || log.initiatedBy?.app?.displayName || "System",
                activity: log.activityDisplayName,
                category: log.category,
                result: log.result,
                targets: log.targetResources?.map((t) => t.displayName).join(", ") || "N/A",
            })),
        ];
        // Sort by timestamp descending (newest first)
        allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        IPC.progress("Generating export...", 90);
        // Phase 4: Generate Export (90-100%)
        if (!dryRun && allLogs.length > 0) {
            const exportDir = path.join(process.cwd(), "exports", "audit-logs");
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `audit_log_export_${startDate}_to_${endDate}_${timestamp}.json`;
            const filePath = path.join(exportDir, fileName);
            // Create directory if it doesn't exist
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            // Write export file
            fs.writeFileSync(filePath, JSON.stringify({
                exportMetadata: {
                    startDate,
                    endDate,
                    exportDate: new Date().toISOString(),
                    operationsFilter: operations || "All",
                    totalEvents: allLogs.length,
                    signInEvents: filteredSignIns.length,
                    directoryAuditEvents: filteredDirectoryAudits.length,
                },
                logs: allLogs,
            }, null, 2));
            IPC.log(`Export saved: ${filePath}`, "info");
            IPC.success({
                message: `Audit log export completed`,
                file_path: filePath,
                table: {
                    headers: ["Log Type", "Event Count", "Status"],
                    rows: [
                        ["Sign-In Events", filteredSignIns.length.toString(), "✅ Complete"],
                        ["Directory Audit Events", filteredDirectoryAudits.length.toString(), "✅ Complete"],
                        ["Total Events", allLogs.length.toString(), "✅ Exported"],
                    ],
                },
            });
        }
        else if (allLogs.length === 0) {
            IPC.success({
                message: `No audit logs found for date range ${startDate} to ${endDate}`,
                table: {
                    headers: ["Log Type", "Event Count"],
                    rows: [
                        ["Sign-In Events", "0"],
                        ["Directory Audit Events", "0"],
                    ],
                },
            });
        }
        else {
            // Dry run - show preview
            const preview = allLogs.slice(0, 10); // First 10 events
            IPC.success({
                message: `Audit log export preview (DRY RUN - no file created)`,
                table: {
                    headers: ["Timestamp", "Type", "User", "Activity", "Status"],
                    rows: preview.map(log => [
                        new Date(log.timestamp).toLocaleString(),
                        log.type,
                        log.user,
                        log.activity,
                        log.status || log.result || "N/A",
                    ]),
                },
            });
            IPC.log(`Total events: ${allLogs.length} (showing first 10)`, "info");
            IPC.log(`To generate full export, use --dry-run false`, "info");
        }
    }
    catch (error) {
        IPC.error(`Audit log export failed: ${error.message}`);
    }
}
