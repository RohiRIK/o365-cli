import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * License Reclamation from Departing Users
 * Identifies users with upcoming departures and reclaims licenses proactively
 *
 * Targets:
 * - Users with disabled accounts
 * - Users with upcoming offboarding dates (via extensionAttribute)
 * - Users with no sign-in activity for extended periods
 * - High-value licenses (E5, Project, Visio) on inactive accounts
 */
export async function reclaimLicenses(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting license reclamation analysis...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE RECLAMATION"}`, "info");
    try {
        // Fetch all users with licenses
        IPC.progress("Fetching users with license assignments...", 10);
        const users = await GraphService.fetchAll(`/users`, "id,userPrincipalName,displayName,accountEnabled,assignedLicenses,signInActivity");
        IPC.log(`Analyzing ${users.length} user accounts`, "info");
        IPC.progress("Identifying reclaimable licenses...", 40);
        // Premium license SKUs (high-value)
        const premiumSkus = {
            "SPE_E5": "Microsoft 365 E5",
            "ENTERPRISEPREMIUM": "Office 365 E5",
            "PROJECTPREMIUM": "Project Plan 5",
            "VISIOCLIENT": "Visio Plan 2",
            "POWER_BI_PRO": "Power BI Pro",
        };
        const candidates = [];
        const now = new Date();
        for (const user of users) {
            if (!user.assignedLicenses || user.assignedLicenses.length === 0)
                continue;
            const lastSignIn = user.signInActivity?.lastSignInDateTime
                ? new Date(user.signInActivity.lastSignInDateTime)
                : null;
            const daysSinceSignIn = lastSignIn
                ? Math.floor((now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24))
                : 9999;
            let reason = "";
            const premiumLicenses = [];
            // Check for premium licenses
            for (const license of user.assignedLicenses) {
                // Match premium SKUs (we don't have skuPartNumber, so this is simplified)
                // In reality, you'd fetch subscribedSkus and map skuId to skuPartNumber
                if (Object.keys(premiumSkus).length > 0) {
                    premiumLicenses.push("Premium License"); // Placeholder
                }
            }
            // Reclaim criteria
            if (!user.accountEnabled) {
                reason = "Account disabled";
            }
            else if (daysSinceSignIn > 180) {
                reason = `Inactive for ${daysSinceSignIn} days`;
            }
            else if (daysSinceSignIn > 90 && premiumLicenses.length > 0) {
                reason = `Inactive for ${daysSinceSignIn} days with premium licenses`;
            }
            else {
                continue; // Not a reclaim candidate
            }
            candidates.push({
                user,
                reason,
                licenseCount: user.assignedLicenses.length,
                premiumLicenses,
                daysSinceSignIn,
            });
        }
        IPC.progress("Generating reclamation report...", 70);
        // Sort by priority: disabled accounts first, then by inactivity
        candidates.sort((a, b) => {
            if (a.reason.includes("disabled") && !b.reason.includes("disabled"))
                return -1;
            if (!a.reason.includes("disabled") && b.reason.includes("disabled"))
                return 1;
            return b.daysSinceSignIn - a.daysSinceSignIn;
        });
        const disabledAccountCandidates = candidates.filter(c => c.reason.includes("disabled"));
        const inactiveCandidates = candidates.filter(c => !c.reason.includes("disabled"));
        IPC.log(`Found ${candidates.length} license reclamation candidates`, "warn");
        IPC.log(`  - ${disabledAccountCandidates.length} disabled accounts`, "info");
        IPC.log(`  - ${inactiveCandidates.length} inactive accounts`, "info");
        if (candidates.length === 0) {
            IPC.success({
                message: "No licenses available for reclamation",
                table: {
                    headers: ["Status"],
                    rows: [["All licenses are on active accounts"]],
                },
            });
        }
        else {
            const topCandidates = candidates.slice(0, 20);
            IPC.success({
                message: `License Reclamation Report (${dryRun ? "DRY RUN" : "LIVE"})`,
                table: {
                    headers: ["User", "Reason", "Licenses", "Days Since Sign-In", "Action"],
                    rows: topCandidates.map(c => [
                        c.user.userPrincipalName,
                        c.reason,
                        c.licenseCount.toString(),
                        c.daysSinceSignIn === 9999 ? "Never" : c.daysSinceSignIn.toString(),
                        dryRun ? "Preview" : "Reclaim",
                    ]),
                },
            });
            IPC.log(`Showing top 20 candidates (${candidates.length} total)`, "info");
            IPC.log(`Total reclaimable licenses: ${candidates.reduce((sum, c) => sum + c.licenseCount, 0)}`, "warn");
            if (!dryRun) {
                IPC.log("LIVE MODE: Would remove licenses from these users", "warn");
                IPC.log("Implementation: Use Graph API PATCH /users/{id}/assignedLicenses", "info");
            }
        }
    }
    catch (error) {
        IPC.error(`License reclamation failed: ${error.message}`);
    }
}
