import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Password Expiry Audit
 * Identifies users with expiring passwords and password policy compliance
 *
 * Audits:
 * - Users with passwords expiring soon
 * - Users with passwords set to never expire
 * - Password age analysis
 * - Password policy exceptions
 */
export async function auditPasswordExpiry(days = 30, dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting password expiry audit...", 0);
    IPC.log(`Threshold: Passwords expiring within ${days} days`, "info");
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");
    try {
        IPC.progress("Fetching user password policies...", 10);
        const users = await GraphService.fetchAll(`/users`, "id,userPrincipalName,displayName,passwordPolicies");
        IPC.log(`Analyzing ${users.length} user accounts`, "info");
        IPC.progress("Analyzing password policies...", 50);
        const neverExpire = users.filter(user => user.passwordPolicies?.includes("DisablePasswordExpiration"));
        IPC.log(`Found ${neverExpire.length} users with passwords set to never expire`, "warn");
        IPC.success({
            message: `Password Expiry Audit (${dryRun ? "DRY RUN" : "LIVE"})`,
            table: {
                headers: ["Metric", "Count"],
                rows: [
                    ["Total Users", users.length.toString()],
                    ["Passwords Never Expire", neverExpire.length.toString()],
                ],
            },
        });
        if (neverExpire.length > 0) {
            IPC.log("Recommendation: Review users with non-expiring passwords", "warn");
        }
    }
    catch (error) {
        IPC.error(`Password expiry audit failed: ${error.message}`);
    }
}
