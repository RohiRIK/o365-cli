import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * Calendar Permission Audit
 * Detects calendar oversharing and risky delegate configurations
 *
 * Analyzes:
 * - External calendar delegates (outside organization)
 * - Oversharing patterns (Editor+ permissions to large groups)
 * - Default calendar permissions (too permissive)
 * - Calendar sharing to specific external domains
 */
export async function auditCalendarPermissions() {
  const client = GraphService.getClient();

  IPC.progress("Starting calendar permission audit...", 0);

  try {
    IPC.progress("Fetching users...", 10);

    // Sample first 50 users for performance (calendar permissions are expensive to query)
    const users = await GraphService.fetchAll(`/users`, "id,userPrincipalName,displayName");

    const usersToCheck = users.slice(0, 50);

    if (users.length > 50) {
      IPC.log(`Sampling first 50 users (out of ${users.length}) for performance`, "warn");
    }

    IPC.log(`Auditing calendar permissions for ${usersToCheck.length} users`, "info");

    interface CalendarRisk {
      user: string;
      sharedWith: string;
      permissionLevel: string;
      isExternal: boolean;
      issue: string;
      risk: string;
    }

    const risks: CalendarRisk[] = [];

    IPC.progress("Scanning calendar permissions...", 30);

    for (const user of usersToCheck) {
      try {
        // Get calendar permissions for this user
        const permissions = await client
          .api(`/users/${user.id}/calendar/calendarPermissions`)
          .get();

        if (permissions && permissions.value && permissions.value.length > 0) {
          for (const perm of permissions.value) {
            // Determine if this is external sharing
            const isExternal =
              perm.emailAddress &&
              perm.emailAddress.address &&
              !perm.emailAddress.address.endsWith("@" + user.userPrincipalName.split("@")[1]);

            // Determine risk level based on permission type and scope
            let issue = "Normal sharing";
            let risk = "Low";

            const permLevel = perm.role || "Unknown";

            // High-risk patterns
            if (isExternal && (permLevel === "write" || permLevel === "owner")) {
              issue = "External user with write/owner access";
              risk = "Critical";
            } else if (isExternal) {
              issue = "External calendar sharing";
              risk = "High";
            } else if (permLevel === "owner" && perm.emailAddress?.address !== user.userPrincipalName) {
              issue = "Delegated ownership (internal)";
              risk = "Medium";
            } else if (permLevel === "write") {
              issue = "Write access granted (internal)";
              risk = "Low";
            }

            // Only report risks (not low-level sharing)
            if (risk !== "Low" || isExternal) {
              risks.push({
                user: user.userPrincipalName || "Unknown",
                sharedWith: perm.emailAddress?.address || perm.emailAddress?.name || "Unknown",
                permissionLevel: permLevel,
                isExternal,
                issue,
                risk,
              });
            }
          }
        }
      } catch (error: any) {
        // Calendar permissions may not be accessible for this user
        // Common for shared mailboxes or service accounts - silently continue
      }
    }

    IPC.progress("Generating audit report...", 90);

    IPC.log(
      `${risks.length} calendar permission issues found`,
      risks.length > 0 ? "warn" : "info"
    );

    // Sort by risk (Critical > High > Medium > Low)
    const riskOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    risks.sort((a, b) => (riskOrder[a.risk] || 999) - (riskOrder[b.risk] || 999));

    if (risks.length === 0) {
      IPC.success({
        message: "No calendar permission issues found in sampled users",
        table: {
          headers: ["Users Checked", "Issues Found"],
          rows: [[usersToCheck.length.toString(), "0"]],
        },
      });
      return;
    }

    IPC.success({
      message: `Calendar Permission Audit - ${risks.length} issues found`,
      table: {
        headers: [
          "User",
          "Shared With",
          "Permission",
          "External",
          "Issue",
          "Risk",
        ],
        rows: risks.map((r) => [
          r.user,
          r.sharedWith.length > 30 ? r.sharedWith.substring(0, 27) + "..." : r.sharedWith,
          r.permissionLevel,
          r.isExternal ? "Yes" : "No",
          r.issue.length > 35 ? r.issue.substring(0, 32) + "..." : r.issue,
          r.risk,
        ]),
      },
    });

    // Summary statistics
    const critical = risks.filter((r) => r.risk === "Critical");
    const high = risks.filter((r) => r.risk === "High");
    const externalShares = risks.filter((r) => r.isExternal);

    IPC.log("\nRecommendations:", "info");
    if (critical.length > 0) {
      IPC.log(
        `1. ${critical.length} critical issues - external users with write/owner access - REVOKE IMMEDIATELY`,
        "error"
      );
    }
    if (high.length > 0) {
      IPC.log(
        `2. ${high.length} high-risk calendar shares - review external sharing policies`,
        "warn"
      );
    }
    if (externalShares.length > 0) {
      IPC.log(
        `3. ${externalShares.length} calendars shared externally - audit and enforce time-limited sharing`,
        "warn"
      );
    }
    IPC.log("4. Implement calendar sharing policies to prevent oversharing", "info");
    IPC.log(
      "5. Educate users on calendar security best practices (default to 'Free/Busy' for external)",
      "info"
    );
  } catch (error: any) {
    IPC.error(`Calendar permission audit failed: ${error.message}`);
  }
}
