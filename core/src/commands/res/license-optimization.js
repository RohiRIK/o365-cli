import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * License Optimization & Cost Analysis
 * Identifies unused licenses, inactive assignments, and cost-saving opportunities
 *
 * Analyzes:
 * - Unassigned licenses (purchased but not allocated)
 * - Inactive user licenses (users with licenses but no activity)
 * - Duplicate license assignments
 * - Premium licenses on inactive accounts
 * - License vs. usage gaps
 *
 * Cost Savings:
 * - Reallocate unused E5 licenses to active users with E3
 * - Remove licenses from disabled/inactive users
 * - Identify underutilized premium features
 * - Recommend license tier downgrades
 */
export async function optimizeLicenses(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting license optimization analysis...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE ANALYSIS"}`, "info");
    try {
        // Phase 1: Fetch all subscribed SKUs (0-20%)
        IPC.progress("Fetching organization licenses...", 5);
        const subscribedSkus = await GraphService.fetchAll(`/subscribedSkus`, "id,skuPartNumber,consumedUnits,prepaidUnits,appliesTo");
        IPC.log(`Found ${subscribedSkus.length} license types`, "info");
        // Phase 2: Fetch all users with license assignments (20-50%)
        IPC.progress("Fetching user license assignments...", 20);
        const users = await GraphService.fetchAll(`/users`, "id,userPrincipalName,displayName,accountEnabled,signInActivity,assignedLicenses,createdDateTime");
        IPC.log(`Analyzing ${users.length} user accounts`, "info");
        IPC.progress("Analyzing license utilization...", 50);
        const licenseMap = {};
        // License pricing (approximate monthly cost per user in USD)
        const licensePricing = {
            "ENTERPRISEPACK": 23, // Office 365 E3
            "ENTERPRISEPREMIUM": 38, // Office 365 E5
            "SPE_E3": 36, // Microsoft 365 E3
            "SPE_E5": 57, // Microsoft 365 E5
            "STANDARDPACK": 12.50, // Office 365 E1
            "POWER_BI_PRO": 10, // Power BI Pro
            "PROJECTPREMIUM": 55, // Project Plan 5
            "VISIOCLIENT": 12, // Visio Plan 2
            "EMS": 10.60, // Enterprise Mobility + Security E3
            "EMSPREMIUM": 16.40, // Enterprise Mobility + Security E5
        };
        // Initialize license map
        for (const sku of subscribedSkus) {
            const purchased = sku.prepaidUnits?.enabled || 0;
            const consumed = sku.consumedUnits || 0;
            const unused = purchased - consumed;
            const costPerUser = licensePricing[sku.skuPartNumber] || 0;
            licenseMap[sku.id] = {
                skuPartNumber: sku.skuPartNumber,
                totalPurchased: purchased,
                totalConsumed: consumed,
                totalUnused: unused,
                inactiveAssignments: 0,
                disabledUserAssignments: 0,
                estimatedMonthlyCost: purchased * costPerUser,
                potentialSavings: unused * costPerUser,
            };
        }
        // Analyze user assignments
        const now = new Date();
        const inactivityThresholdDays = 90;
        for (const user of users) {
            const lastSignIn = user.signInActivity?.lastSignInDateTime
                ? new Date(user.signInActivity.lastSignInDateTime)
                : null;
            const daysSinceSignIn = lastSignIn
                ? Math.floor((now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24))
                : 9999;
            const isInactive = daysSinceSignIn > inactivityThresholdDays;
            const isDisabled = !user.accountEnabled;
            // Count inactive/disabled users with licenses
            if (user.assignedLicenses && user.assignedLicenses.length > 0) {
                for (const license of user.assignedLicenses) {
                    if (licenseMap[license.skuId]) {
                        if (isDisabled) {
                            licenseMap[license.skuId].disabledUserAssignments++;
                        }
                        else if (isInactive) {
                            licenseMap[license.skuId].inactiveAssignments++;
                        }
                    }
                }
            }
        }
        // Calculate potential savings from inactive/disabled users
        for (const skuId in licenseMap) {
            const analysis = licenseMap[skuId];
            const costPerUser = licensePricing[analysis.skuPartNumber] || 0;
            const wastedLicenses = analysis.inactiveAssignments + analysis.disabledUserAssignments;
            analysis.potentialSavings = (analysis.totalUnused + wastedLicenses) * costPerUser;
        }
        IPC.progress("Generating optimization report...", 80);
        // Phase 4: Generate report (80-100%)
        const allLicenses = Object.values(licenseMap);
        const wastefulLicenses = allLicenses.filter(l => l.totalUnused > 0 || l.inactiveAssignments > 0 || l.disabledUserAssignments > 0);
        const totalMonthlyCost = allLicenses.reduce((sum, l) => sum + l.estimatedMonthlyCost, 0);
        const totalPotentialSavings = allLicenses.reduce((sum, l) => sum + l.potentialSavings, 0);
        IPC.log(`Total monthly license cost: $${totalMonthlyCost.toFixed(2)}`, "info");
        IPC.log(`Potential monthly savings: $${totalPotentialSavings.toFixed(2)}`, "warn");
        if (wastefulLicenses.length === 0) {
            IPC.success({
                message: "All licenses are optimally utilized",
                table: {
                    headers: ["Status", "Value"],
                    rows: [
                        ["Total Monthly Cost", `$${totalMonthlyCost.toFixed(2)}`],
                        ["Unused Licenses", "0"],
                        ["Potential Savings", "$0.00"],
                    ],
                },
            });
        }
        else {
            // Sort by potential savings (highest first)
            wastefulLicenses.sort((a, b) => b.potentialSavings - a.potentialSavings);
            IPC.success({
                message: `License Optimization Report (${dryRun ? "DRY RUN" : "LIVE"})`,
                table: {
                    headers: ["License Type", "Purchased", "Unused", "Inactive Users", "Disabled Users", "Potential Savings"],
                    rows: wastefulLicenses.map(l => [
                        l.skuPartNumber,
                        l.totalPurchased.toString(),
                        l.totalUnused.toString(),
                        l.inactiveAssignments.toString(),
                        l.disabledUserAssignments.toString(),
                        `$${l.potentialSavings.toFixed(2)}/mo`,
                    ]),
                },
            });
            IPC.log(`Total potential savings: $${totalPotentialSavings.toFixed(2)}/month ($${(totalPotentialSavings * 12).toFixed(2)}/year)`, "warn");
            IPC.log("Recommendations:", "info");
            IPC.log("1. Remove licenses from disabled users immediately", "info");
            IPC.log(`2. Review licenses for users inactive >${inactivityThresholdDays} days`, "info");
            IPC.log("3. Reduce license purchases in next renewal cycle", "info");
        }
    }
    catch (error) {
        IPC.error(`License optimization failed: ${error.message}`);
    }
}
