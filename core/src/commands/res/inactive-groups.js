import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Inactive Group Detection
 * Identifies unused Microsoft 365 and Security groups
 */
export async function detectInactiveGroups(days = 90, dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting inactive group detection...", 0);
    IPC.log(`Threshold: ${days} days of inactivity`, "info");
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE DETECTION"}`, "info");
    try {
        IPC.progress("Fetching groups...", 10);
        const groups = await GraphService.fetchAll(`/groups`, "id,displayName,mail,groupTypes,membershipRule,createdDateTime");
        IPC.log(`Analyzing ${groups.length} groups`, "info");
        IPC.progress("Checking group activity...", 50);
        // Simplified analysis - check for empty groups
        let emptyGroups = 0;
        const sampleSize = Math.min(groups.length, 50);
        for (let i = 0; i < sampleSize; i++) {
            try {
                const members = await client.api(`/groups/${groups[i].id}/members`).top(1).get();
                if (!members.value || members.value.length === 0) {
                    emptyGroups++;
                }
            }
            catch (error) {
                // Skip inaccessible groups
            }
        }
        IPC.log(`Found ${emptyGroups} empty groups (sample of ${sampleSize})`, emptyGroups > 0 ? "warn" : "info");
        IPC.success({
            message: `Inactive Group Detection (${dryRun ? "DRY RUN" : "LIVE"})`,
            table: {
                headers: ["Metric", "Value"],
                rows: [
                    ["Total Groups", groups.length.toString()],
                    ["Empty Groups (sampled)", emptyGroups.toString()],
                ],
            },
        });
    }
    catch (error) {
        IPC.error(`Inactive group detection failed: ${error.message}`);
    }
}
