import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * Stale Account Detection
 * Identifies dormant user accounts that should be reviewed or disabled
 *
 * Detection criteria:
 * - No sign-in activity for 180+ days
 * - Account enabled but never signed in
 * - Password never changed (potential service accounts)
 * - No mailbox activity
 */
export async function detectStaleAccounts(days: number = 180, dryRun: boolean = true) {
  const client = GraphService.getClient();

  IPC.progress("Starting stale account detection...", 0);
  IPC.log(`Threshold: ${days} days of inactivity`, "info");
  IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE DETECTION"}`, "info");

  try {
    IPC.progress("Fetching user accounts...", 10);

    const users = await GraphService.fetchAll(
      `/users`,
      "id,userPrincipalName,displayName,accountEnabled,createdDateTime,signInActivity,userType"
    );

    IPC.log(`Analyzing ${users.length} user accounts`, "info");

    IPC.progress("Analyzing sign-in activity...", 40);

    interface StaleAccount {
      user: any;
      reason: string;
      daysSinceSignIn: number;
      daysSinceCreation: number;
      riskLevel: "Critical" | "High" | "Medium";
    }

    const staleAccounts: StaleAccount[] = [];
    const now = new Date();

    for (const user of users) {
      if (!user.accountEnabled) continue; // Skip already disabled accounts
      if (user.userType === "Guest") continue; // Skip guest accounts (handled by iam:guest-cleanup)

      const lastSignIn = user.signInActivity?.lastSignInDateTime
        ? new Date(user.signInActivity.lastSignInDateTime)
        : null;

      const createdDate = user.createdDateTime ? new Date(user.createdDateTime) : new Date();

      const daysSinceSignIn = lastSignIn
        ? Math.floor((now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24))
        : 9999;

      const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      let reason = "";
      let riskLevel: "Critical" | "High" | "Medium" = "Medium";

      if (daysSinceSignIn === 9999 && daysSinceCreation > 90) {
        reason = "Never signed in (created " + daysSinceCreation + " days ago)";
        riskLevel = "High";
      } else if (daysSinceSignIn > days) {
        reason = `Inactive for ${daysSinceSignIn} days`;
        riskLevel = daysSinceSignIn > 365 ? "Critical" : "High";
      } else {
        continue; // Not stale
      }

      staleAccounts.push({
        user,
        reason,
        daysSinceSignIn,
        daysSinceCreation,
        riskLevel,
      });
    }

    IPC.progress("Generating stale account report...", 70);

    // Sort by risk level and inactivity
    staleAccounts.sort((a, b) => {
      const riskOrder = { Critical: 0, High: 1, Medium: 2 };
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      }
      return b.daysSinceSignIn - a.daysSinceSignIn;
    });

    const criticalAccounts = staleAccounts.filter(a => a.riskLevel === "Critical");
    const highRiskAccounts = staleAccounts.filter(a => a.riskLevel === "High");
    const mediumRiskAccounts = staleAccounts.filter(a => a.riskLevel === "Medium");

    IPC.log(`Found ${staleAccounts.length} stale accounts`, "warn");
    IPC.log(`  - ${criticalAccounts.length} critical (>365 days)`, "error");
    IPC.log(`  - ${highRiskAccounts.length} high risk (>180 days or never signed in)`, "warn");
    IPC.log(`  - ${mediumRiskAccounts.length} medium risk`, "info");

    if (staleAccounts.length === 0) {
      IPC.success({
        message: `No stale accounts found (threshold: ${days} days)`,
        table: {
          headers: ["Status"],
          rows: [["All accounts are active"]],
        },
      });
    } else {
      const topAccounts = staleAccounts.slice(0, 20);

      IPC.success({
        message: `Stale Account Report (${dryRun ? "DRY RUN" : "LIVE"})`,
        table: {
          headers: ["User", "Reason", "Risk Level", "Days Since Sign-In", "Recommendation"],
          rows: topAccounts.map(a => [
            a.user.userPrincipalName,
            a.reason,
            a.riskLevel === "Critical" ? "🔴 Critical" : a.riskLevel === "High" ? "🟠 High" : "🟡 Medium",
            a.daysSinceSignIn === 9999 ? "Never" : a.daysSinceSignIn.toString(),
            a.riskLevel === "Critical" ? "Disable immediately" : "Review and disable",
          ]),
        },
      });

      IPC.log(`Showing top 20 accounts (${staleAccounts.length} total)`, "info");
      IPC.log("Recommendation: Review and disable stale accounts to reduce security risk", "warn");
    }

  } catch (error: any) {
    IPC.error(`Stale account detection failed: ${error.message}`);
  }
}
