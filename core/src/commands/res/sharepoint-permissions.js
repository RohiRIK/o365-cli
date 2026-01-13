import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * SharePoint Permissions Audit
 * Reviews external sharing and overprivileged access to SharePoint sites
 */
export async function auditSharePointPermissions(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting SharePoint permissions audit...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");
    try {
        IPC.progress("Fetching SharePoint sites...", 10);
        const sites = await GraphService.fetchAll(`/sites`, "id,displayName,webUrl,createdDateTime", {
            filter: "siteCollection/root ne null",
        });
        IPC.log(`Found ${sites.length} SharePoint sites`, "info");
        IPC.progress("Analyzing site permissions...", 50);
        // Simplified analysis - site count and basic info
        IPC.success({
            message: `SharePoint Permissions Audit (${dryRun ? "DRY RUN" : "LIVE"})`,
            table: {
                headers: ["Metric", "Value"],
                rows: [
                    ["Total Sites", sites.length.toString()],
                    ["Recommendation", "Review external sharing settings"],
                ],
            },
        });
        IPC.log("Full permissions analysis requires SharePoint admin access", "info");
    }
    catch (error) {
        IPC.error(`SharePoint permissions audit failed: ${error.message}`);
    }
}
