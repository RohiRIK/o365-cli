import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

interface ActionItem {
  type: "DRY-RUN" | "SUCCESS" | "INFO" | "WARNING" | "ERROR";
  detail: string;
}

export async function cleanupGuests(daysThreshold: number = 90, dryRun: boolean = true) {
  IPC.progress(`Starting Guest User Cleanup (Threshold: ${daysThreshold} days)...`, 0);
  const client = GraphService.getClient();
  const now = new Date();

  try {
    // 1. Fetch all Guest Users
    IPC.progress("Fetching guest user accounts...", 10);
    const guests = await GraphService.fetchAll("/users", {
      filter: "userType eq 'Guest'",
      select: "id,displayName,userPrincipalName,userType,externalUserState,signInActivity,mail,accountEnabled",
      expand: "manager($select=displayName,userPrincipalName,mail)"
    });

    IPC.progress(`Analyzing ${guests.length} guest users...`, 20);

    const actionTable: string[][] = [];
    let processedCount = 0;

    for (const user of guests) {
      processedCount++;
      if (processedCount % 10 === 0) {
        IPC.progress(`Analyzing users: ${processedCount}/${guests.length}`, 20 + (processedCount / guests.length) * 60);
      }

      const actions: ActionItem[] = [];
      let isStale = false;
      let hasNoSponsor = false;

      // Check for Staleness
      if (user.signInActivity?.lastSignInDateTime) {
        const lastSignIn = new Date(user.signInActivity.lastSignInDateTime);
        const diffDays = Math.floor((now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > daysThreshold) {
          isStale = true;
          actions.push({ type: "WARNING", detail: `Stale: Last sign-in ${diffDays} days ago` });
        }
      } else {
        // If no sign-in activity recorded, assume potentially stale or never used
        actions.push({ type: "INFO", detail: "No sign-in activity recorded" });
      }

      // Check for Sponsor
      if (!user.manager) {
        hasNoSponsor = true;
        actions.push({ type: "WARNING", detail: "No assigned sponsor/manager found" });
      } else {
        const sponsorName = user.manager.displayName || user.manager.userPrincipalName || user.manager.mail;
        actions.push({ type: "INFO", detail: `Sponsor: ${sponsorName}` });
      }

      // Remediation Logic
      if (isStale || hasNoSponsor) {
        const reason = isStale && hasNoSponsor ? "Stale & No Sponsor" : isStale ? "Stale Account" : "No Sponsor";
        
        if (user.accountEnabled) {
            if (dryRun) {
                actions.push({ type: "DRY-RUN", detail: `Would block sign-in for ${user.displayName}` });
            } else {
                try {
                    await client.api(`/users/${user.id}`).update({ accountEnabled: false });
                    actions.push({ type: "SUCCESS", detail: `Blocked sign-in for ${user.displayName}` });
                } catch (e: any) {
                    actions.push({ type: "ERROR", detail: `Failed to block: ${e.message}` });
                }
            }
        } else {
            actions.push({ type: "INFO", detail: "Account already disabled" });
        }
      }

      // Add to summary table if any warning/action occurred
      if (actions.some(a => a.type === "WARNING" || a.type === "DRY-RUN" || a.type === "SUCCESS")) {
          const detailSummary = actions.map(a => `[${a.type}] ${a.detail}`).join("; ");
          actionTable.push([
              user.displayName || "Unknown",
              user.userPrincipalName,
              user.accountEnabled ? "Enabled" : "Disabled",
              detailSummary
          ]);
      }
    }

    IPC.progress("Cleanup analysis complete", 100);

    if (actionTable.length === 0) {
      IPC.success({ message: "✅ All guest accounts appear healthy and active." });
    } else {
      IPC.success({
        message: dryRun ? `Guest Cleanup Preview (${actionTable.length} accounts flagged)` : `Guest Cleanup Executed (${actionTable.length} accounts processed)`,
        table: {
          headers: ["Guest Name", "UPN", "Status", "Actions/Findings"],
          rows: actionTable
        }
      });
    }

  } catch (error: any) {
    IPC.error(error.message || "Unknown error during guest cleanup");
  }
}
