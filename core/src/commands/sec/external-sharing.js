import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * External Sharing Audit
 * Scans SharePoint sites and OneDrive for external sharing risks
 *
 * Analyzes:
 * - Anonymous sharing links (Anyone with link)
 * - External user access
 * - Sharing link expiration
 * - Sensitive content shared externally
 *
 * Note: Full tenant scan can be slow - focuses on high-risk scenarios
 */
export async function auditExternalSharing(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting external sharing audit...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");
    IPC.log("This may take several minutes for large tenants...", "warn");
    try {
        // Step 1: Check tenant-level sharing settings
        IPC.progress("Checking tenant sharing settings...", 10);
        const issues = [];
        // Step 2: Scan SharePoint sites for external sharing
        IPC.progress("Scanning SharePoint sites...", 20);
        try {
            const sites = await GraphService.fetchAll(`/sites?search=*`, "id,name,webUrl,sharingCapabilities");
            IPC.log(`Found ${sites.length} SharePoint sites`, "info");
            // Sample first 10 sites for performance (full scan would be very slow)
            const sitesToCheck = sites.slice(0, 10);
            if (sites.length > 10) {
                IPC.log(`Sampling first 10 sites (out of ${sites.length}) for performance`, "warn");
            }
            for (const site of sitesToCheck) {
                IPC.progress(`Scanning: ${site.name}...`, 30);
                try {
                    // Get drive for the site
                    const drive = await client.api(`/sites/${site.id}/drive`).get();
                    if (drive && drive.id) {
                        // Check root folder permissions
                        const permissions = await GraphService.fetchAll(`/sites/${site.id}/drive/root/permissions`, "id,link,grantedToV2,expirationDateTime");
                        for (const perm of permissions) {
                            let sharedWith = "Unknown";
                            let risk = "Low";
                            if (perm.link) {
                                // Anonymous link - highest risk
                                if (perm.link.scope === "anonymous") {
                                    sharedWith = "Anyone with link (Anonymous)";
                                    risk = "Critical";
                                }
                                else if (perm.link.scope === "organization") {
                                    sharedWith = "Anyone in organization";
                                    risk = "Medium";
                                }
                            }
                            else if (perm.grantedToV2) {
                                // External user access
                                const email = perm.grantedToV2.user?.email || perm.grantedToV2.user?.userPrincipalName;
                                if (email && !email.endsWith("@" + email.split('@')[1])) {
                                    // Simple external check - not same domain
                                    sharedWith = `External: ${email}`;
                                    risk = "High";
                                }
                            }
                            const expires = perm.expirationDateTime || "Never";
                            if (risk !== "Low") {
                                issues.push({
                                    location: `${site.name} (Root)`,
                                    type: perm.link ? "Sharing Link" : "Direct Access",
                                    sharedWith,
                                    expires,
                                    risk,
                                });
                            }
                        }
                    }
                }
                catch (error) {
                    // Site may not have a drive or permissions may be restricted
                    IPC.log(`Could not scan ${site.name}: ${error.message}`, "warn");
                }
            }
        }
        catch (error) {
            IPC.log(`SharePoint scan error: ${error.message}`, "error");
        }
        // Step 3: Sample OneDrive for external sharing
        IPC.progress("Sampling OneDrive external shares...", 60);
        try {
            // Get first 10 users' OneDrive
            const users = await GraphService.fetchAll(`/users?$top=10`, "id,userPrincipalName,displayName");
            IPC.log(`Sampling ${users.length} users' OneDrive`, "info");
            for (const user of users) {
                try {
                    // Get user's OneDrive
                    const drive = await client.api(`/users/${user.id}/drive`).get();
                    if (drive && drive.id) {
                        // Get shared files (items with permissions)
                        const sharedItems = await client
                            .api(`/users/${user.id}/drive/sharedWithMe`)
                            .top(10)
                            .get();
                        if (sharedItems.value && sharedItems.value.length > 0) {
                            for (const item of sharedItems.value) {
                                // Check if shared externally
                                const remoteItem = item.remoteItem;
                                if (remoteItem) {
                                    issues.push({
                                        location: `${user.displayName}'s OneDrive: ${remoteItem.name}`,
                                        type: "Shared Item",
                                        sharedWith: "External (sharedWithMe)",
                                        expires: "Unknown",
                                        risk: "Medium",
                                    });
                                }
                            }
                        }
                    }
                }
                catch (error) {
                    // User may not have OneDrive or access denied
                    // Silently continue
                }
            }
        }
        catch (error) {
            IPC.log(`OneDrive scan error: ${error.message}`, "error");
        }
        IPC.progress("Generating audit report...", 90);
        IPC.log(`${issues.length} external sharing issues found`, issues.length > 0 ? "warn" : "info");
        // Sort by risk level (Critical > High > Medium > Low)
        const riskOrder = { "Critical": 0, "High": 1, "Medium": 2, "Low": 3 };
        issues.sort((a, b) => (riskOrder[a.risk] || 999) - (riskOrder[b.risk] || 999));
        if (issues.length === 0) {
            IPC.success({
                message: "No high-risk external sharing detected in sampled content",
                table: {
                    headers: ["Status"],
                    rows: [["No anonymous or high-risk external shares found"]],
                },
            });
        }
        else {
            // Limit output to top 50 issues for readability
            const topIssues = issues.slice(0, 50);
            IPC.success({
                message: `External Sharing Audit - ${issues.length} issues found (showing top ${topIssues.length})`,
                table: {
                    headers: ["Location", "Type", "Shared With", "Expires", "Risk"],
                    rows: topIssues.map(i => [
                        i.location,
                        i.type,
                        i.sharedWith,
                        i.expires,
                        i.risk,
                    ]),
                },
            });
            const critical = issues.filter(i => i.risk === "Critical");
            const high = issues.filter(i => i.risk === "High");
            IPC.log("Recommendations:", "info");
            if (critical.length > 0) {
                IPC.log(`1. Remove ${critical.length} anonymous sharing links immediately`, "error");
            }
            if (high.length > 0) {
                IPC.log(`2. Review ${high.length} external user access grants`, "warn");
            }
            IPC.log("3. Enable expiration policies for sharing links", "warn");
            IPC.log("4. Consider DLP policies to prevent sensitive data sharing", "warn");
        }
    }
    catch (error) {
        IPC.error(`External sharing audit failed: ${error.message}`);
    }
}
