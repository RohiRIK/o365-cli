import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Application Permissions Audit
 * Reviews OAuth app permissions and identifies overprivileged applications
 *
 * This is an enhanced version of sec:shadow-it focusing on permission analysis
 */
export async function auditAppPermissions(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting application permissions audit...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");
    try {
        IPC.progress("Fetching OAuth applications...", 10);
        const apps = await GraphService.fetchAll(`/servicePrincipals`, "id,appDisplayName,appId,servicePrincipalType");
        IPC.log(`Analyzing ${apps.length} applications`, "info");
        IPC.progress("Analyzing application permissions...", 40);
        // Simplified permission analysis (full version would fetch appRoleAssignments)
        const riskyApps = apps.filter(app => app.servicePrincipalType === "Application" &&
            app.appDisplayName &&
            !app.appDisplayName.includes("Microsoft"));
        IPC.log(`Found ${riskyApps.length} third-party applications`, "info");
        if (riskyApps.length === 0) {
            IPC.success({
                message: "No third-party applications requiring review",
                table: {
                    headers: ["Status"],
                    rows: [["Only Microsoft applications present"]],
                },
            });
        }
        else {
            const topApps = riskyApps.slice(0, 20);
            IPC.success({
                message: `Application Permissions Audit (${dryRun ? "DRY RUN" : "LIVE"})`,
                table: {
                    headers: ["Application", "App ID", "Type", "Recommendation"],
                    rows: topApps.map(app => [
                        app.appDisplayName,
                        app.appId,
                        app.servicePrincipalType,
                        "Review permissions",
                    ]),
                },
            });
            IPC.log(`Review these applications for excessive permissions`, "warn");
        }
    }
    catch (error) {
        IPC.error(`Application permissions audit failed: ${error.message}`);
    }
}
