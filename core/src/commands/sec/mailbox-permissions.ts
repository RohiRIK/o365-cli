import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * Mailbox Permissions Audit
 * Detects unauthorized full-access delegates and cross-departmental mailbox access
 *
 * Analyzes:
 * - Mailbox delegates with full access
 * - Cross-departmental access patterns
 * - Dormant delegates (inactive >90 days)
 * - Shared mailbox delegate counts
 *
 * Note: Full mailbox permission audit requires Exchange Online API access.
 * This implementation uses Graph API mailboxSettings which has limited delegate info.
 */
export async function auditMailboxPermissions(dryRun: boolean = true) {
  const client = GraphService.getClient();

  IPC.progress("Starting mailbox permissions audit...", 0);
  IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");

  try {
    IPC.progress("Fetching users and mailbox delegates...", 10);

    // Get all users with department info for cross-department detection
    const users = await GraphService.fetchAll(
      `/users`,
      "id,userPrincipalName,displayName,department,signInActivity"
    );

    IPC.log(`Analyzing ${users.length} user mailboxes`, "info");

    interface PermissionIssue {
      mailbox: string;
      delegate: string;
      mailboxDept: string;
      delegateDept: string;
      lastSignIn: string;
      issue: string;
      risk: string;
    }

    const issues: PermissionIssue[] = [];

    IPC.progress("Scanning mailbox delegates...", 30);

    // Sample first 20 users for performance (full scan can be very slow)
    const usersToCheck = users.slice(0, 20);

    if (users.length > 20) {
      IPC.log(`Sampling first 20 users (out of ${users.length}) for performance`, "warn");
    }

    for (const user of usersToCheck) {
      try {
        // Try to get mailbox delegates via mailboxSettings
        // Note: This API endpoint may not return full delegate information
        const mailboxSettings = await client
          .api(`/users/${user.id}/mailboxSettings`)
          .get();

        // Check for delegate settings
        if (mailboxSettings.delegateMeetingMessageDeliveryOptions) {
          IPC.log(`${user.userPrincipalName} has delegate settings`, "info");
        }

        // Try to get calendar delegates (another indicator of mailbox access)
        try {
          const calendar = await client
            .api(`/users/${user.id}/calendar`)
            .get();

          if (calendar) {
            // Try to get calendar permissions
            const permissions = await client
              .api(`/users/${user.id}/calendar/calendarPermissions`)
              .get();

            if (permissions.value && permissions.value.length > 0) {
              for (const perm of permissions.value) {
                // Check if delegate is from different department
                const delegateEmail = perm.emailAddress?.address;
                if (delegateEmail) {
                  const delegate = users.find(u => u.userPrincipalName === delegateEmail);

                  if (delegate) {
                    const mailboxDept = user.department || "Unknown";
                    const delegateDept = delegate.department || "Unknown";

                    // Flag cross-departmental access
                    if (mailboxDept !== "Unknown" && delegateDept !== "Unknown" && mailboxDept !== delegateDept) {
                      const lastSignIn = delegate.signInActivity?.lastSignInDateTime
                        ? new Date(delegate.signInActivity.lastSignInDateTime).toISOString().split('T')[0]
                        : "Never";

                      issues.push({
                        mailbox: user.userPrincipalName,
                        delegate: delegateEmail,
                        mailboxDept,
                        delegateDept,
                        lastSignIn,
                        issue: "Cross-departmental access",
                        risk: "Medium",
                      });
                    }

                    // Flag dormant delegates
                    if (delegate.signInActivity?.lastSignInDateTime) {
                      const daysSinceSignIn = Math.floor(
                        (Date.now() - new Date(delegate.signInActivity.lastSignInDateTime).getTime()) /
                        (1000 * 60 * 60 * 24)
                      );

                      if (daysSinceSignIn > 90) {
                        issues.push({
                          mailbox: user.userPrincipalName,
                          delegate: delegateEmail,
                          mailboxDept: user.department || "Unknown",
                          delegateDept: delegate.department || "Unknown",
                          lastSignIn: new Date(delegate.signInActivity.lastSignInDateTime).toISOString().split('T')[0],
                          issue: `Dormant delegate (${daysSinceSignIn} days)`,
                          risk: "High",
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (error: any) {
          // Calendar permissions may not be accessible - silently continue
        }

      } catch (error: any) {
        // User may not have mailbox or access denied - silently continue
      }
    }

    IPC.progress("Checking shared mailboxes...", 70);

    // Check shared mailboxes for delegate sprawl
    try {
      const sharedMailboxes = users.filter(u =>
        u.userPrincipalName && u.userPrincipalName.toLowerCase().includes("shared")
      );

      IPC.log(`Found ${sharedMailboxes.length} potential shared mailboxes (by naming convention)`, "info");

      for (const sharedMB of sharedMailboxes.slice(0, 10)) {
        try {
          const permissions = await client
            .api(`/users/${sharedMB.id}/calendar/calendarPermissions`)
            .get();

          if (permissions.value && permissions.value.length > 10) {
            issues.push({
              mailbox: sharedMB.userPrincipalName,
              delegate: `${permissions.value.length} delegates`,
              mailboxDept: "Shared",
              delegateDept: "Multiple",
              lastSignIn: "N/A",
              issue: "Excessive delegates on shared mailbox",
              risk: "Medium",
            });
          }
        } catch (error: any) {
          // Shared mailbox may not have calendar - silently continue
        }
      }
    } catch (error: any) {
      IPC.log(`Shared mailbox scan error: ${error.message}`, "warn");
    }

    IPC.progress("Generating audit report...", 90);

    IPC.log(`${issues.length} mailbox permission issues found`, issues.length > 0 ? "warn" : "info");

    // Sort by risk level (High > Medium > Low)
    const riskOrder = { "High": 0, "Medium": 1, "Low": 2 };
    issues.sort((a, b) => (riskOrder[a.risk] || 999) - (riskOrder[b.risk] || 999));

    if (issues.length === 0) {
      IPC.success({
        message: `No mailbox permission issues detected in sampled mailboxes`,
        table: {
          headers: ["Status"],
          rows: [["No cross-departmental or dormant delegates found"]],
        },
      });
    } else {
      IPC.success({
        message: `Mailbox Permissions Audit - ${issues.length} issues found`,
        table: {
          headers: ["Mailbox", "Delegate", "Mailbox Dept", "Delegate Dept", "Last Sign-In", "Issue", "Risk"],
          rows: issues.map(i => [
            i.mailbox,
            i.delegate,
            i.mailboxDept,
            i.delegateDept,
            i.lastSignIn,
            i.issue,
            i.risk,
          ]),
        },
      });

      const dormant = issues.filter(i => i.issue.includes("Dormant"));
      const crossDept = issues.filter(i => i.issue.includes("Cross-departmental"));

      IPC.log("Recommendations:", "info");
      if (dormant.length > 0) {
        IPC.log(`1. Remove ${dormant.length} dormant delegate permissions (inactive >90 days)`, "warn");
      }
      if (crossDept.length > 0) {
        IPC.log(`2. Review ${crossDept.length} cross-departmental mailbox access grants`, "warn");
      }
      IPC.log("3. Implement regular mailbox permission reviews", "info");
      IPC.log("4. Consider using shared mailboxes instead of delegation", "info");
    }

    IPC.log("Note: This audit uses limited Graph API capabilities. For comprehensive mailbox permission audits, use Exchange Online PowerShell.", "warn");

  } catch (error: any) {
    IPC.error(`Mailbox permissions audit failed: ${error.message}`);
  }
}
