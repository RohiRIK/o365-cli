import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
import * as fs from "fs";
import * as path from "path";
/**
 * DLP Violation Report
 * Generate DLP policy violation report
 *
 * Identifies:
 * - Users with most violations
 * - File types involved in violations
 * - Sensitive data exposure patterns
 * - Policy violation trends
 */
export async function generateDLPViolationReport(days, dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting DLP violation report generation...", 0);
    IPC.log(`Lookback period: ${days} days`, "info");
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE REPORT"}`, "info");
    try {
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startIso = startDate.toISOString();
        const endIso = endDate.toISOString();
        // Phase 1: Fetch Security Alerts (0-40%)
        IPC.progress("Fetching security alerts for DLP violations...", 5);
        let securityAlerts = [];
        try {
            securityAlerts = await GraphService.fetchAll(`/security/alerts_v2`, "id,createdDateTime,title,severity,category,userStates,fileStates,status", {
                filter: `createdDateTime ge ${startIso} and createdDateTime le ${endIso}`,
            });
            IPC.log(`Found ${securityAlerts.length} security alerts`, "info");
            // Filter for DLP-related alerts
            securityAlerts = securityAlerts.filter((alert) => alert.category?.toLowerCase().includes("dlp") ||
                alert.category?.toLowerCase().includes("data loss") ||
                alert.category?.toLowerCase().includes("information protection") ||
                alert.title?.toLowerCase().includes("dlp") ||
                alert.title?.toLowerCase().includes("sensitive"));
            IPC.log(`Filtered to ${securityAlerts.length} DLP-related alerts`, "info");
        }
        catch (error) {
            IPC.log(`Security alerts access denied: ${error.message}`, "warn");
            IPC.log("Requires SecurityEvents.Read.All permission", "warn");
        }
        IPC.progress("Fetching audit logs for DLP events...", 40);
        // Phase 2: Fetch Unified Audit Logs for DLP Events (40-70%)
        let auditLogs = [];
        try {
            auditLogs = await GraphService.fetchAll(`/auditLogs/directoryAudits`, "id,activityDateTime,activityDisplayName,category,result,initiatedBy,targetResources,additionalDetails", {
                filter: `activityDateTime ge ${startIso} and activityDateTime le ${endIso}`,
            });
            // Filter for DLP-related activities
            auditLogs = auditLogs.filter((log) => log.category?.toLowerCase().includes("dlp") ||
                log.category?.toLowerCase().includes("informationprotection") ||
                log.activityDisplayName?.toLowerCase().includes("dlp") ||
                log.activityDisplayName?.toLowerCase().includes("sensitive") ||
                log.activityDisplayName?.toLowerCase().includes("label"));
            IPC.log(`Found ${auditLogs.length} DLP-related audit events`, "info");
        }
        catch (error) {
            IPC.log(`Audit logs access denied: ${error.message}`, "warn");
            IPC.log("Requires AuditLog.Read.All permission", "warn");
        }
        // Phase 3: Transform to Violations (70-85%)
        IPC.progress("Processing violations...", 70);
        const violations = [];
        // Transform security alerts to violations
        securityAlerts.forEach((alert) => {
            const userState = alert.userStates?.[0];
            const fileState = alert.fileStates?.[0];
            violations.push({
                timestamp: alert.createdDateTime,
                user: userState?.userPrincipalName || "Unknown",
                fileName: fileState?.name || "Unknown",
                fileType: fileState?.fileType || getFileExtension(fileState?.name || ""),
                location: fileState?.path || "Unknown",
                policyName: alert.title || "Unknown Policy",
                sensitiveType: extractSensitiveType(alert.title || ""),
                action: alert.status || "Detected",
                severity: mapSeverity(alert.severity),
            });
        });
        // Transform audit logs to violations
        auditLogs.forEach((log) => {
            const user = log.initiatedBy?.user?.userPrincipalName || log.initiatedBy?.app?.displayName || "System";
            const target = log.targetResources?.[0];
            violations.push({
                timestamp: log.activityDateTime,
                user: user,
                fileName: target?.displayName || "Unknown",
                fileType: getFileTypeFromActivity(log.activityDisplayName || ""),
                location: extractLocation(log.additionalDetails),
                policyName: log.activityDisplayName || "Unknown Policy",
                sensitiveType: extractSensitiveTypeFromLog(log),
                action: log.result || "Detected",
                severity: "medium", // Default for audit log entries
            });
        });
        // Sort by timestamp descending
        violations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        IPC.log(`Processed ${violations.length} total violations`, "info");
        // Phase 4: Generate Statistics (85-95%)
        IPC.progress("Generating statistics...", 85);
        const stats = generateStatistics(violations);
        IPC.progress("Generating report...", 95);
        // Phase 5: Export Report (95-100%)
        if (!dryRun && violations.length > 0) {
            const exportDir = path.join(process.cwd(), "exports", "dlp-violations");
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `dlp_violations_${days}day_${timestamp}.json`;
            const filePath = path.join(exportDir, fileName);
            // Create directory if it doesn't exist
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            // Write export file
            fs.writeFileSync(filePath, JSON.stringify({
                reportMetadata: {
                    reportDate: new Date().toISOString(),
                    lookbackDays: days,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    totalViolations: violations.length,
                },
                statistics: stats,
                violations: violations,
            }, null, 2));
            IPC.log(`Report saved: ${filePath}`, "info");
            IPC.success({
                message: `DLP violation report completed`,
                file_path: filePath,
                table: {
                    headers: ["Category", "Count", "Status"],
                    rows: [
                        ["Total Violations", stats.totalViolations.toString(), stats.totalViolations > 0 ? "⚠️ Review" : "✅"],
                        ["High Severity", stats.violationsBySeverity.high.toString(), stats.violationsBySeverity.high > 0 ? "🚨 Critical" : "✅"],
                        ["Medium Severity", stats.violationsBySeverity.medium.toString(), stats.violationsBySeverity.medium > 0 ? "⚠️ Review" : "✅"],
                        ["Low Severity", stats.violationsBySeverity.low.toString(), "ℹ️"],
                        ["Unique Users", stats.topUsers.length.toString(), "ℹ️"],
                        ["Unique File Types", stats.topFileTypes.length.toString(), "ℹ️"],
                    ],
                },
            });
            // Show top violators
            if (stats.topUsers.length > 0) {
                IPC.log("\nTop Violators:", "info");
                stats.topUsers.slice(0, 5).forEach((u, i) => {
                    IPC.log(`${i + 1}. ${u.user} - ${u.count} violations`, "warn");
                });
            }
            // Show top file types
            if (stats.topFileTypes.length > 0) {
                IPC.log("\nTop File Types:", "info");
                stats.topFileTypes.slice(0, 5).forEach((ft, i) => {
                    IPC.log(`${i + 1}. ${ft.fileType} - ${ft.count} violations`, "info");
                });
            }
        }
        else if (violations.length === 0) {
            IPC.success({
                message: `No DLP violations found for the last ${days} days`,
                table: {
                    headers: ["Status", "Details"],
                    rows: [
                        ["Security Alerts", securityAlerts.length > 0 ? `${securityAlerts.length} (non-DLP)` : "None or access denied"],
                        ["Audit Logs", auditLogs.length > 0 ? `${auditLogs.length} (non-DLP)` : "None or access denied"],
                        ["DLP Violations", "0"],
                    ],
                },
            });
            IPC.log("This may be due to missing permissions, no DLP policies, or no violations in this period", "info");
            IPC.log("Required permissions: SecurityEvents.Read.All, InformationProtectionPolicy.Read", "info");
        }
        else {
            // Dry run - show preview
            const preview = violations.slice(0, 10);
            IPC.success({
                message: `DLP violation report preview (DRY RUN - no file created)`,
                table: {
                    headers: ["Timestamp", "User", "File", "Policy", "Severity"],
                    rows: preview.map(v => [
                        new Date(v.timestamp).toLocaleString(),
                        v.user,
                        v.fileName.length > 30 ? v.fileName.substring(0, 27) + "..." : v.fileName,
                        v.policyName.length > 30 ? v.policyName.substring(0, 27) + "..." : v.policyName,
                        v.severity.toUpperCase(),
                    ]),
                },
            });
            IPC.log(`\nViolation Summary:`, "info");
            IPC.log(`- Total: ${stats.totalViolations}`, "info");
            IPC.log(`- High Severity: ${stats.violationsBySeverity.high}`, "info");
            IPC.log(`- Medium Severity: ${stats.violationsBySeverity.medium}`, "info");
            IPC.log(`- Low Severity: ${stats.violationsBySeverity.low}`, "info");
            IPC.log(`\nTo generate full report, use --dry-run false`, "info");
        }
    }
    catch (error) {
        IPC.error(`DLP violation report failed: ${error.message}`);
    }
}
// Helper functions
function getFileExtension(fileName) {
    const parts = fileName.split(".");
    return parts.length > 1 ? parts[parts.length - 1] : "unknown";
}
function extractSensitiveType(title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("credit card"))
        return "Credit Card Number";
    if (lowerTitle.includes("ssn") || lowerTitle.includes("social security"))
        return "Social Security Number";
    if (lowerTitle.includes("passport"))
        return "Passport Number";
    if (lowerTitle.includes("pii"))
        return "Personally Identifiable Information";
    if (lowerTitle.includes("phi") || lowerTitle.includes("health"))
        return "Protected Health Information";
    if (lowerTitle.includes("financial"))
        return "Financial Information";
    return "Sensitive Information";
}
function extractSensitiveTypeFromLog(log) {
    const activityName = (log.activityDisplayName || "").toLowerCase();
    if (activityName.includes("confidential"))
        return "Confidential";
    if (activityName.includes("secret"))
        return "Secret";
    if (activityName.includes("internal"))
        return "Internal";
    if (activityName.includes("personal"))
        return "Personal Data";
    return "Sensitive Information";
}
function getFileTypeFromActivity(activity) {
    const lowerActivity = activity.toLowerCase();
    if (lowerActivity.includes("excel") || lowerActivity.includes(".xlsx"))
        return "xlsx";
    if (lowerActivity.includes("word") || lowerActivity.includes(".docx"))
        return "docx";
    if (lowerActivity.includes("pdf"))
        return "pdf";
    if (lowerActivity.includes("email"))
        return "email";
    return "unknown";
}
function extractLocation(additionalDetails) {
    if (!additionalDetails || additionalDetails.length === 0)
        return "Unknown";
    const locationDetail = additionalDetails.find((d) => d.key?.toLowerCase().includes("location"));
    return locationDetail?.value || "Unknown";
}
function mapSeverity(severity) {
    const lower = (severity || "").toLowerCase();
    if (lower.includes("high") || lower.includes("critical"))
        return "high";
    if (lower.includes("medium"))
        return "medium";
    return "low";
}
function generateStatistics(violations) {
    const userCounts = new Map();
    const fileTypeCounts = new Map();
    const policyCounts = new Map();
    const sensitiveTypeCounts = new Map();
    const severityCounts = { high: 0, medium: 0, low: 0 };
    violations.forEach(v => {
        // Count by user
        userCounts.set(v.user, (userCounts.get(v.user) || 0) + 1);
        // Count by file type
        fileTypeCounts.set(v.fileType, (fileTypeCounts.get(v.fileType) || 0) + 1);
        // Count by policy
        policyCounts.set(v.policyName, (policyCounts.get(v.policyName) || 0) + 1);
        // Count by sensitive type
        sensitiveTypeCounts.set(v.sensitiveType, (sensitiveTypeCounts.get(v.sensitiveType) || 0) + 1);
        // Count by severity
        severityCounts[v.severity]++;
    });
    // Sort and get top items
    const topUsers = Array.from(userCounts.entries())
        .map(([user, count]) => ({ user, count }))
        .sort((a, b) => b.count - a.count);
    const topFileTypes = Array.from(fileTypeCounts.entries())
        .map(([fileType, count]) => ({ fileType, count }))
        .sort((a, b) => b.count - a.count);
    const topPolicies = Array.from(policyCounts.entries())
        .map(([policy, count]) => ({ policy, count }))
        .sort((a, b) => b.count - a.count);
    const topSensitiveTypes = Array.from(sensitiveTypeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
    return {
        totalViolations: violations.length,
        topUsers,
        topFileTypes,
        topPolicies,
        topSensitiveTypes,
        violationsBySeverity: severityCounts,
    };
}
