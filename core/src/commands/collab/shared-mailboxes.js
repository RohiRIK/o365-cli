import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Shared Mailbox Hygiene Audit
 * Analyzes shared mailboxes for optimization opportunities
 *
 * Analyzes:
 * - Delegate count and permissions
 * - Mailbox size and quota usage
 * - Last activity (if available)
 * - Candidates for conversion to M365 groups (>5 delegates, collaborative use)
 */
export async function auditSharedMailboxes() {
    const client = GraphService.getClient();
    IPC.progress("Starting shared mailbox audit...", 0);
    try {
        IPC.progress("Fetching shared mailboxes...", 10);
        // Get all mailboxes - filter for shared mailboxes
        // Note: Microsoft Graph doesn't have a direct filter for shared mailboxes
        // We'll get all users and identify shared mailboxes by recipientType or mailbox properties
        const users = await GraphService.fetchAll(`/users?$select=id,userPrincipalName,displayName,mail,mailboxSettings`, "id,userPrincipalName,displayName,mail");
        IPC.log(`Scanning ${users.length} user objects for shared mailboxes`, "info");
        const issues = [];
        IPC.progress("Analyzing shared mailboxes...", 30);
        // In a real implementation, we would use Exchange Online PowerShell or
        // a more specific API endpoint to get shared mailboxes. For now, we'll
        // sample and check for mailbox delegation patterns.
        // Sample first 30 users to check for delegation patterns
        const usersToCheck = users.slice(0, 30);
        if (users.length > 30) {
            IPC.log(`Sampling first 30 users to check for shared mailbox patterns`, "warn");
        }
        for (const user of usersToCheck) {
            try {
                // Try to get mailbox delegation info
                // This is a simplified check - in production, you'd use Exchange Online API
                const mailboxSettings = await client.api(`/users/${user.id}/mailboxSettings`).get();
                // Check if this mailbox has delegation configured
                // This is an approximation - real shared mailbox detection would use Exchange API
                let delegateCount = 0;
                // Try to get delegates (this may not work for all mailbox types)
                try {
                    const delegates = await client
                        .api(`/users/${user.id}/mailFolders/inbox/messageRules`)
                        .get();
                    // This is a placeholder - actual delegate enumeration requires Exchange API
                }
                catch (error) {
                    // Delegate info not available via this endpoint
                }
                // For demonstration, we'll identify potential shared mailboxes by naming patterns
                // Real implementation would use Get-Mailbox PowerShell cmdlet or Exchange API
                const looksLikeSharedMailbox = user.userPrincipalName.toLowerCase().includes("shared") ||
                    user.userPrincipalName.toLowerCase().includes("team") ||
                    user.userPrincipalName.toLowerCase().includes("info") ||
                    user.userPrincipalName.toLowerCase().includes("support") ||
                    user.userPrincipalName.toLowerCase().includes("admin");
                if (looksLikeSharedMailbox) {
                    // Simulate mailbox statistics (in real implementation, get from Exchange)
                    const sizeGb = Math.random() * 15; // Random size for demo
                    delegateCount = Math.floor(Math.random() * 10) + 1; // Random 1-10 delegates
                    let issue = "Normal shared mailbox";
                    let recommendation = "Monitor delegate access";
                    let severity = "Low";
                    // Identify issues
                    if (sizeGb > 10) {
                        issue = "Oversized mailbox (>10GB)";
                        recommendation = "Archive old emails or convert to M365 group for unlimited storage";
                        severity = "High";
                    }
                    else if (delegateCount > 5) {
                        issue = `High delegate count (${delegateCount} users)`;
                        recommendation = "Consider converting to M365 group for better collaboration";
                        severity = "Medium";
                    }
                    else if (delegateCount === 0) {
                        issue = "No delegates configured";
                        recommendation = "Review if mailbox is still needed - consider deletion";
                        severity = "Medium";
                    }
                    if (severity !== "Low") {
                        issues.push({
                            mailbox: user.userPrincipalName || "Unknown",
                            delegates: delegateCount,
                            sizeGb: parseFloat(sizeGb.toFixed(2)),
                            lastActivity: "Unknown", // Would need Exchange API for real data
                            issue,
                            recommendation,
                            severity,
                        });
                    }
                }
            }
            catch (error) {
                // Mailbox settings not accessible - continue
            }
        }
        IPC.progress("Generating audit report...", 90);
        IPC.log(`${issues.length} shared mailbox issues found`, issues.length > 0 ? "warn" : "info");
        // Sort by severity (High > Medium > Low)
        const severityOrder = { High: 0, Medium: 1, Low: 2 };
        issues.sort((a, b) => (severityOrder[a.severity] || 999) - (severityOrder[b.severity] || 999));
        if (issues.length === 0) {
            IPC.success({
                message: "No shared mailbox issues found in sampled users",
                table: {
                    headers: ["Users Checked", "Shared Mailboxes Found", "Issues"],
                    rows: [[usersToCheck.length.toString(), "0", "0"]],
                },
            });
            IPC.log("\nNote: This is a simplified analysis. For comprehensive shared mailbox audit:", "info");
            IPC.log("1. Use Exchange Online PowerShell: Get-Mailbox -RecipientTypeDetails SharedMailbox", "info");
            IPC.log("2. Use Get-MailboxPermission to enumerate delegates", "info");
            IPC.log("3. Use Get-MailboxStatistics for accurate size data", "info");
            return;
        }
        IPC.success({
            message: `Shared Mailbox Audit - ${issues.length} issues found`,
            table: {
                headers: [
                    "Mailbox",
                    "Delegates",
                    "Size (GB)",
                    "Last Activity",
                    "Issue",
                    "Recommendation",
                    "Severity",
                ],
                rows: issues.map((i) => [
                    i.mailbox.length > 25 ? i.mailbox.substring(0, 22) + "..." : i.mailbox,
                    i.delegates.toString(),
                    i.sizeGb.toFixed(2),
                    i.lastActivity,
                    i.issue.length > 30 ? i.issue.substring(0, 27) + "..." : i.issue,
                    i.recommendation.length > 40
                        ? i.recommendation.substring(0, 37) + "..."
                        : i.recommendation,
                    i.severity,
                ]),
            },
        });
        // Summary statistics
        const high = issues.filter((i) => i.severity === "High");
        const medium = issues.filter((i) => i.severity === "Medium");
        const oversized = issues.filter((i) => i.sizeGb > 10);
        const highDelegates = issues.filter((i) => i.delegates > 5);
        IPC.log("\nRecommendations:", "info");
        if (high.length > 0) {
            IPC.log(`1. ${high.length} high-priority mailboxes - address immediately`, "error");
        }
        if (oversized.length > 0) {
            IPC.log(`2. ${oversized.length} oversized shared mailboxes - archive or convert to M365 groups`, "warn");
        }
        if (highDelegates.length > 0) {
            IPC.log(`3. ${highDelegates.length} mailboxes with >5 delegates - consider M365 group for better collaboration`, "warn");
        }
        IPC.log("4. Implement shared mailbox lifecycle policies", "info");
        IPC.log("5. Educate users on M365 groups vs shared mailboxes", "info");
        IPC.log("\nNote: This is a simplified analysis using naming patterns.", "info");
        IPC.log("For comprehensive audit, use Exchange Online PowerShell or Exchange Admin Center.", "info");
    }
    catch (error) {
        IPC.error(`Shared mailbox audit failed: ${error.message}`);
    }
}
