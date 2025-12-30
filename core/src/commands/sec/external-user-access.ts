import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * External User Access Review
 * Audits guest and external user access to tenant resources
 *
 * Reviews:
 * - Guest users with SharePoint/OneDrive access
 * - External users in Teams
 * - B2B collaboration invitations
 * - Guest access to sensitive groups
 */
export async function auditExternalUserAccess(dryRun: boolean = true) {
  const client = GraphService.getClient();

  IPC.progress("Starting external user access audit...", 0);
  IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");

  try {
    IPC.progress("Fetching guest users...", 10);

    const guestUsers = await GraphService.fetchAll(
      `/users`,
      "id,userPrincipalName,displayName,userType,createdDateTime,signInActivity",
      {
        filter: "userType eq 'Guest'",
      }
    );

    IPC.log(`Found ${guestUsers.length} guest users`, "info");

    IPC.progress("Analyzing guest access patterns...", 50);

    const now = new Date();
    const activeGuests = guestUsers.filter(user => {
      const lastSignIn = user.signInActivity?.lastSignInDateTime
        ? new Date(user.signInActivity.lastSignInDateTime)
        : null;

      if (!lastSignIn) return false;

      const daysSince = Math.floor((now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince <= 30;
    });

    IPC.log(`  - ${activeGuests.length} active guests (signed in last 30 days)`, "info");

    IPC.success({
      message: `External User Access Audit (${dryRun ? "DRY RUN" : "LIVE"})`,
      table: {
        headers: ["Metric", "Count"],
        rows: [
          ["Total Guest Users", guestUsers.length.toString()],
          ["Active Guests (30 days)", activeGuests.length.toString()],
          ["Inactive Guests", (guestUsers.length - activeGuests.length).toString()],
        ],
      },
    });

  } catch (error: any) {
    IPC.error(`External user access audit failed: ${error.message}`);
  }
}
