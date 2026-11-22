import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * OneDrive Storage Cleanup
 * Identifies users approaching quota limits and large file hoarders
 *
 * Analyzes:
 * - OneDrive storage usage vs quota
 * - Users approaching quota limits (>90% used)
 * - Large file detection (>1GB per file)
 * - Storage trends and cleanup recommendations
 */
export async function analyzeOneDriveSprawl(thresholdGb = 500, dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting OneDrive storage analysis...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE ANALYSIS"}`, "info");
    IPC.log(`Large storage threshold: ${thresholdGb} GB`, "info");
    try {
        IPC.progress("Fetching user OneDrive data...", 10);
        const users = await GraphService.fetchAll(`/users`, "id,userPrincipalName,displayName");
        IPC.log(`Analyzing OneDrive storage for ${users.length} users`, "info");
        const issues = [];
        IPC.progress("Scanning OneDrive storage...", 30);
        // Sample first 20 users for performance
        const usersToCheck = users.slice(0, 20);
        if (users.length > 20) {
            IPC.log(`Sampling first 20 users (out of ${users.length}) for performance`, "warn");
        }
        for (const user of usersToCheck) {
            try {
                // Get user's OneDrive
                const drive = await client.api(`/users/${user.id}/drive`).get();
                if (drive && drive.quota) {
                    const usedBytes = drive.quota.used || 0;
                    const totalBytes = drive.quota.total || 1;
                    const usedGb = usedBytes / (1024 * 1024 * 1024);
                    const quotaGb = totalBytes / (1024 * 1024 * 1024);
                    const percentUsed = (usedBytes / totalBytes) * 100;
                    let largestFile = "N/A";
                    let largestFileSizeGb = 0;
                    // Try to find largest files
                    try {
                        const files = await client
                            .api(`/users/${user.id}/drive/root/children`)
                            .top(10)
                            .orderby("size desc")
                            .get();
                        if (files.value && files.value.length > 0) {
                            const largest = files.value[0];
                            largestFile = largest.name || "Unknown";
                            largestFileSizeGb = (largest.size || 0) / (1024 * 1024 * 1024);
                        }
                    }
                    catch (error) {
                        // Failed to get files - continue without largest file info
                    }
                    let issue = "Normal usage";
                    let severity = "Low";
                    // Flag users approaching quota
                    if (percentUsed > 90) {
                        issue = `Approaching quota (${percentUsed.toFixed(1)}% used)`;
                        severity = "Critical";
                    }
                    else if (percentUsed > 75) {
                        issue = `High usage (${percentUsed.toFixed(1)}% used)`;
                        severity = "High";
                    }
                    else if (usedGb > thresholdGb) {
                        issue = `Large storage user (${usedGb.toFixed(1)}GB used)`;
                        severity = "Medium";
                    }
                    else if (largestFileSizeGb > 1) {
                        issue = `Large file detected (${largestFileSizeGb.toFixed(1)}GB)`;
                        severity = "Medium";
                    }
                    if (severity !== "Low") {
                        issues.push({
                            user: user.userPrincipalName || "Unknown",
                            usedGb,
                            quotaGb,
                            percentUsed,
                            largestFile,
                            largestFileSizeGb,
                            issue,
                            severity,
                        });
                    }
                }
            }
            catch (error) {
                // User may not have OneDrive or access denied - silently continue
            }
        }
        IPC.progress("Generating cleanup report...", 90);
        IPC.log(`${issues.length} storage issues found`, issues.length > 0 ? "warn" : "info");
        // Sort by severity (Critical > High > Medium)
        const severityOrder = { "Critical": 0, "High": 1, "Medium": 2 };
        issues.sort((a, b) => (severityOrder[a.severity] || 999) - (severityOrder[b.severity] || 999));
        if (issues.length === 0) {
            IPC.success({
                message: `All sampled OneDrive accounts are within normal usage (< ${thresholdGb}GB, <75% quota)`,
                table: {
                    headers: ["Users Checked", "Issues Found"],
                    rows: [[
                            usersToCheck.length.toString(),
                            "0"
                        ]],
                },
            });
        }
        else {
            IPC.success({
                message: `OneDrive Storage Cleanup - ${issues.length} issues found`,
                table: {
                    headers: ["User", "Used", "Quota", "% Used", "Largest File", "Issue", "Severity"],
                    rows: issues.map(i => [
                        i.user,
                        `${i.usedGb.toFixed(1)} GB`,
                        `${i.quotaGb.toFixed(1)} GB`,
                        `${i.percentUsed.toFixed(1)}%`,
                        i.largestFile.length > 30 ? i.largestFile.substring(0, 27) + "..." : i.largestFile,
                        i.issue,
                        i.severity,
                    ]),
                },
            });
            const critical = issues.filter(i => i.severity === "Critical");
            const high = issues.filter(i => i.severity === "High");
            const largeFiles = issues.filter(i => i.largestFileSizeGb > 1);
            IPC.log("Recommendations:", "info");
            if (critical.length > 0) {
                IPC.log(`1. ${critical.length} users approaching quota - notify immediately`, "error");
            }
            if (high.length > 0) {
                IPC.log(`2. ${high.length} users with high usage - monitor and send warnings`, "warn");
            }
            if (largeFiles.length > 0) {
                IPC.log(`3. ${largeFiles.length} users with large files (>1GB) - recommend archiving or deletion`, "warn");
            }
            IPC.log("4. Implement OneDrive cleanup policies and auto-archiving", "info");
            IPC.log("5. Educate users on OneDrive best practices", "info");
        }
    }
    catch (error) {
        IPC.error(`OneDrive storage analysis failed: ${error.message}`);
    }
}
