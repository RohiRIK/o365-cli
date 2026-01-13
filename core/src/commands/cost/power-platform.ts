import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * Power Platform License Audit
 * Identifies unused Power Apps, Power Automate, and Power BI premium licenses
 *
 * Analyzes:
 * - Power Apps per user/per app licenses
 * - Power Automate per user/per flow licenses
 * - Power BI Pro and Premium licenses
 * - Usage patterns and inactive assignments
 */
export async function auditPowerPlatformLicenses(dryRun: boolean = true) {
  const client = GraphService.getClient();

  IPC.progress("Starting Power Platform license audit...", 0);
  IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");

  try {
    // Power Platform SKU identifiers
    const powerPlatformSkus: Record<string, { name: string, cost: number }> = {
      "POWER_BI_PRO": { name: "Power BI Pro", cost: 10 },
      "POWER_BI_STANDARD": { name: "Power BI Standard", cost: 0 },
      "POWERAPPS_PER_USER": { name: "Power Apps per user", cost: 20 },
      "FLOW_PER_USER": { name: "Power Automate per user", cost: 15 },
      "POWERAPPS_DEV": { name: "Power Apps for Developer", cost: 0 },
      "DYN365_ENTERPRISE_P1": { name: "Dynamics 365 P1", cost: 100 },
    };

    IPC.progress("Fetching subscribed SKUs...", 10);

    const subscribedSkus = await GraphService.fetchAll(
      `/subscribedSkus`,
      "id,skuPartNumber,consumedUnits,prepaidUnits"
    );

    // Filter for Power Platform licenses
    const powerPlatformLicenses = subscribedSkus.filter(sku =>
      sku.skuPartNumber in powerPlatformSkus
    );

    if (powerPlatformLicenses.length === 0) {
      IPC.success({
        message: "No Power Platform licenses found in this tenant",
        table: {
          headers: ["Status"],
          rows: [["No Power Platform licenses purchased"]],
        },
      });
      return;
    }

    IPC.log(`Found ${powerPlatformLicenses.length} Power Platform license types`, "info");

    IPC.progress("Fetching user license assignments...", 30);

    const users = await GraphService.fetchAll(
      `/users`,
      "id,userPrincipalName,displayName,accountEnabled,signInActivity,assignedLicenses"
    );

    IPC.progress("Analyzing license utilization...", 60);

    interface LicenseAssignment {
      userPrincipalName: string;
      displayName: string;
      licenseName: string;
      accountEnabled: boolean;
      lastSignIn: string | null;
      daysSinceSignIn: number;
      recommendation: string;
      potentialSavings: number;
    }

    const assignments: LicenseAssignment[] = [];
    const now = new Date();
    const inactivityThresholdDays = 90;

    // Analyze each user's Power Platform licenses
    for (const user of users) {
      if (!user.assignedLicenses || user.assignedLicenses.length === 0) {
        continue;
      }

      const lastSignIn = user.signInActivity?.lastSignInDateTime
        ? new Date(user.signInActivity.lastSignInDateTime)
        : null;

      const daysSinceSignIn = lastSignIn
        ? Math.floor((now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24))
        : 9999;

      for (const license of user.assignedLicenses) {
        const matchingSku = powerPlatformLicenses.find(sku => sku.id === license.skuId);

        if (matchingSku) {
          const skuInfo = powerPlatformSkus[matchingSku.skuPartNumber];
          let recommendation = "In use";
          let potentialSavings = 0;

          if (!user.accountEnabled) {
            recommendation = "Remove - Account disabled";
            potentialSavings = skuInfo.cost;
          } else if (daysSinceSignIn > inactivityThresholdDays) {
            recommendation = `Remove - Inactive ${daysSinceSignIn} days`;
            potentialSavings = skuInfo.cost;
          }

          assignments.push({
            userPrincipalName: user.userPrincipalName,
            displayName: user.displayName,
            licenseName: skuInfo.name,
            accountEnabled: user.accountEnabled,
            lastSignIn: lastSignIn ? lastSignIn.toISOString().split('T')[0] : "Never",
            daysSinceSignIn,
            recommendation,
            potentialSavings,
          });
        }
      }
    }

    IPC.progress("Generating audit report...", 90);

    const wastefulAssignments = assignments.filter(a => a.potentialSavings > 0);
    const totalPotentialSavings = wastefulAssignments.reduce((sum, a) => sum + a.potentialSavings, 0);

    IPC.log(`Total Power Platform licenses assigned: ${assignments.length}`, "info");
    IPC.log(`Wasteful assignments: ${wastefulAssignments.length}`, "warn");
    IPC.log(`Potential monthly savings: $${totalPotentialSavings.toFixed(2)}`, "warn");

    if (wastefulAssignments.length === 0) {
      IPC.success({
        message: "All Power Platform licenses are optimally utilized",
        table: {
          headers: ["Total Licenses", "Active Users", "Potential Savings"],
          rows: [[
            assignments.length.toString(),
            assignments.filter(a => a.accountEnabled && a.daysSinceSignIn <= inactivityThresholdDays).length.toString(),
            "$0.00/mo"
          ]],
        },
      });
    } else {
      // Sort by potential savings (highest first)
      wastefulAssignments.sort((a, b) => b.potentialSavings - a.potentialSavings);

      IPC.success({
        message: `Power Platform License Audit (${dryRun ? "DRY RUN" : "LIVE"})`,
        table: {
          headers: ["User", "License", "Last Sign-In", "Recommendation", "Savings/mo"],
          rows: wastefulAssignments.map(a => [
            a.userPrincipalName,
            a.licenseName,
            a.lastSignIn,
            a.recommendation,
            `$${a.potentialSavings.toFixed(2)}`,
          ]),
        },
      });

      IPC.log(`Total potential savings: $${totalPotentialSavings.toFixed(2)}/month ($${(totalPotentialSavings * 12).toFixed(2)}/year)`, "warn");
      IPC.log("Recommendations:", "info");
      IPC.log("1. Remove licenses from disabled accounts immediately", "info");
      IPC.log(`2. Review licenses for users inactive >${inactivityThresholdDays} days`, "info");
      IPC.log("3. Consider downgrading to lower-tier licenses for light users", "info");
    }

  } catch (error: any) {
    IPC.error(`Power Platform audit failed: ${error.message}`);
  }
}
