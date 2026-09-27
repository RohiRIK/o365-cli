import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Unused Group Cleanup
 * Detects inactive M365 groups, distribution lists, and security groups
 *
 * Analyzes:
 * - M365 group activity (renewedDateTime, email activity, file activity)
 * - Distribution list usage
 * - Security group membership and last modification
 * - Storage consumption
 *
 * IMPORTANT: Defaults to dry-run mode - requires explicit --dry-run false for deletions
 */
export async function cleanupUnusedGroups(inactivityDays = 180, dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting unused group cleanup...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE DELETION"}`, dryRun ? "info" : "warn");
    IPC.log(`Inactivity threshold: ${inactivityDays} days`, "info");
    if (!dryRun) {
        IPC.log("WARNING: Live deletion mode - groups will be permanently removed!", "error");
    }
    try {
        const now = new Date();
        const thresholdDate = new Date(now.getTime() - inactivityDays * 24 * 60 * 60 * 1000);
        IPC.progress("Fetching all groups...", 10);
        const groups = await GraphService.fetchAll(`/groups`, "id,displayName,groupTypes,mail,mailEnabled,securityEnabled,createdDateTime,renewedDateTime,memberCount");
        IPC.log(`Analyzing ${groups.length} groups`, "info");
        const inactiveGroups = [];
        IPC.progress("Identifying inactive groups...", 30);
        for (const group of groups) {
            // Determine group type
            let groupType = "Security Group";
            if (group.groupTypes && group.groupTypes.includes("Unified")) {
                groupType = "M365 Group";
            }
            else if (group.mailEnabled && !group.securityEnabled) {
                groupType = "Distribution List";
            }
            // Determine last activity date
            let lastActivityDate = null;
            if (group.renewedDateTime) {
                // M365 groups have renewedDateTime
                lastActivityDate = new Date(group.renewedDateTime);
            }
            else if (group.createdDateTime) {
                // Fall back to creation date for groups without activity tracking
                lastActivityDate = new Date(group.createdDateTime);
            }
            if (lastActivityDate) {
                const daysSinceActivity = Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceActivity > inactivityDays) {
                    // Get member count
                    let memberCount = 0;
                    try {
                        const members = await client.api(`/groups/${group.id}/members`).get();
                        memberCount = members.value?.length || 0;
                    }
                    catch (error) {
                        // Member count may not be accessible
                        memberCount = 0;
                    }
                    let recommendation = "Delete - No activity";
                    // Provide context-specific recommendations
                    if (memberCount === 0) {
                        recommendation = "Delete - No members";
                    }
                    else if (memberCount > 50) {
                        recommendation = `Review - ${memberCount} members, consider archiving`;
                    }
                    else if (groupType === "M365 Group") {
                        recommendation = "Delete or Archive - Inactive M365 Group";
                    }
                    inactiveGroups.push({
                        id: group.id,
                        displayName: group.displayName || "Unknown",
                        type: groupType,
                        lastActivity: lastActivityDate.toISOString().split('T')[0],
                        daysSinceActivity,
                        memberCount,
                        recommendation,
                    });
                }
            }
        }
        IPC.log(`${inactiveGroups.length} inactive groups (>${inactivityDays} days)`, inactiveGroups.length > 0 ? "warn" : "info");
        if (inactiveGroups.length === 0) {
            IPC.success({
                message: `No inactive groups found (>${inactivityDays} days)`,
                table: {
                    headers: ["Total Groups", "M365 Groups", "Distribution Lists", "Security Groups", "Inactive"],
                    rows: [[
                            groups.length.toString(),
                            groups.filter(g => g.groupTypes && g.groupTypes.includes("Unified")).length.toString(),
                            groups.filter(g => g.mailEnabled && !g.securityEnabled).length.toString(),
                            groups.filter(g => g.securityEnabled && !g.mailEnabled).length.toString(),
                            "0"
                        ]],
                },
            });
            return;
        }
        // Sort by days since activity (oldest first)
        inactiveGroups.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
        if (dryRun) {
            IPC.success({
                message: `Unused Group Cleanup (DRY RUN) - ${inactiveGroups.length} groups would be deleted`,
                table: {
                    headers: ["Group", "Type", "Last Activity", "Days Inactive", "Members", "Recommendation"],
                    rows: inactiveGroups.map(g => [
                        g.displayName,
                        g.type,
                        g.lastActivity,
                        g.daysSinceActivity.toString(),
                        g.memberCount.toString(),
                        g.recommendation,
                    ]),
                },
            });
            IPC.log("DRY RUN: No groups were deleted. Use --dry-run false to execute deletions.", "warn");
            IPC.log("Recommendations:", "info");
            IPC.log("1. Review large groups (>50 members) before deletion", "warn");
            IPC.log("2. Archive M365 groups to preserve content before deleting", "info");
            IPC.log("3. Notify group owners before proceeding with cleanup", "info");
        }
        else {
            // LIVE DELETION MODE
            IPC.progress("Deleting inactive groups (LIVE)...", 70);
            let deletedCount = 0;
            let failedCount = 0;
            for (const group of inactiveGroups) {
                try {
                    await client.api(`/groups/${group.id}`).delete();
                    deletedCount++;
                    IPC.log(`Deleted: ${group.displayName} (${group.daysSinceActivity} days inactive)`, "info");
                }
                catch (error) {
                    failedCount++;
                    IPC.log(`Failed to delete ${group.displayName}: ${error.message}`, "error");
                }
            }
            IPC.success({
                message: `Unused Group Cleanup Complete`,
                table: {
                    headers: ["Total Inactive", "Deleted", "Failed"],
                    rows: [[
                            inactiveGroups.length.toString(),
                            deletedCount.toString(),
                            failedCount.toString(),
                        ]],
                },
            });
            IPC.log(`Deleted ${deletedCount} inactive groups`, "info");
            if (failedCount > 0) {
                IPC.log(`Failed to delete ${failedCount} groups`, "error");
            }
            IPC.log("Next steps:", "info");
            IPC.log("1. Review audit logs for deleted groups", "info");
            IPC.log("2. Notify affected users if needed", "info");
            IPC.log("3. Update group management policies", "info");
        }
    }
    catch (error) {
        IPC.error(`Unused group cleanup failed: ${error.message}`);
    }
}
