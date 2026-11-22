import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * 360° User Analyzer
 * Comprehensive pre-offboarding asset map across all M365 services
 *
 * Aggregates:
 * - User profile and licenses
 * - Group memberships
 * - Owned devices
 * - OneDrive files and storage
 * - Teams memberships and ownership
 * - Mail rules and delegates
 * - SharePoint sites owned
 * - Calendar delegates
 *
 * Use case: Pre-offboarding dependency analysis
 */
export async function analyzeUser(userEmail: string) {
  const client = GraphService.getClient();

  IPC.progress("Starting 360° user analysis...", 0);
  IPC.log(`Analyzing user: ${userEmail}`, "info");

  try {
    // Step 1: Get user profile
    IPC.progress("Fetching user profile...", 5);

    let user: any;
    try {
      user = await client
        .api(`/users/${userEmail}`)
        .select(
          "id,userPrincipalName,displayName,jobTitle,department,accountEnabled,createdDateTime,assignedLicenses"
        )
        .get();
    } catch (error: any) {
      IPC.error(`User not found: ${userEmail}`);
      return;
    }

    const userId = user.id;

    IPC.log(`User found: ${user.displayName}`, "info");
    IPC.log(`Job Title: ${user.jobTitle || "N/A"}`, "info");
    IPC.log(`Department: ${user.department || "N/A"}`, "info");
    IPC.log(`Account Status: ${user.accountEnabled ? "Enabled" : "Disabled"}`, "info");

    // Step 2: Get group memberships
    IPC.progress("Fetching group memberships...", 15);

    const groups = await client.api(`/users/${userId}/memberOf`).get();
    const groupCount = groups.value?.length || 0;

    IPC.log(`Group memberships: ${groupCount}`, "info");

    // Step 3: Get owned devices
    IPC.progress("Fetching owned devices...", 25);

    const devices = await client.api(`/users/${userId}/ownedDevices`).get();
    const deviceCount = devices.value?.length || 0;

    IPC.log(`Owned devices: ${deviceCount}`, "info");

    // Step 4: Get OneDrive storage
    IPC.progress("Analyzing OneDrive storage...", 35);

    let driveInfo: any = null;
    let oneDriveFiles: any[] = [];
    try {
      driveInfo = await client.api(`/users/${userId}/drive`).get();

      // Get top 10 files by size
      const files = await client
        .api(`/users/${userId}/drive/root/children`)
        .top(10)
        .orderby("size desc")
        .get();
      oneDriveFiles = files.value || [];
    } catch (error: any) {
      IPC.log("OneDrive not accessible or not provisioned", "warn");
    }

    const storageUsedGb = driveInfo?.quota?.used
      ? (driveInfo.quota.used / (1024 * 1024 * 1024)).toFixed(2)
      : "N/A";

    IPC.log(`OneDrive storage: ${storageUsedGb}GB`, "info");

    // Step 5: Get Teams memberships
    IPC.progress("Fetching Teams memberships...", 45);

    let teams: any[] = [];
    try {
      const teamsResponse = await client.api(`/users/${userId}/joinedTeams`).get();
      teams = teamsResponse.value || [];
    } catch (error: any) {
      IPC.log("Teams data not accessible", "warn");
    }

    IPC.log(`Teams memberships: ${teams.length}`, "info");

    // Step 6: Get mail rules (delegates)
    IPC.progress("Checking mail rules and delegates...", 55);

    let mailRules: any[] = [];
    try {
      const rulesResponse = await client
        .api(`/users/${userId}/mailFolders/inbox/messageRules`)
        .get();
      mailRules = rulesResponse.value || [];
    } catch (error: any) {
      IPC.log("Mail rules not accessible", "warn");
    }

    IPC.log(`Mail rules: ${mailRules.length}`, "info");

    // Step 7: Get calendar delegates
    IPC.progress("Checking calendar permissions...", 65);

    let calendarDelegates: any[] = [];
    try {
      const perms = await client.api(`/users/${userId}/calendar/calendarPermissions`).get();
      calendarDelegates = perms.value || [];
    } catch (error: any) {
      IPC.log("Calendar permissions not accessible", "warn");
    }

    IPC.log(`Calendar delegates: ${calendarDelegates.length}`, "info");

    // Step 8: Find SharePoint sites where user is owner
    IPC.progress("Searching SharePoint site ownership...", 75);

    let ownedSites: any[] = [];
    try {
      // Search for sites where user might be owner
      // Note: This is a simplified search - production would use more specific queries
      const sites = await client.api("/sites?search=*").top(50).get();

      for (const site of sites.value || []) {
        try {
          const siteOwners = await client.api(`/sites/${site.id}/owners`).get();
          const isOwner = siteOwners.value?.some(
            (owner: any) => owner.userPrincipalName === userEmail
          );
          if (isOwner) {
            ownedSites.push(site);
          }
        } catch (error: any) {
          // Site ownership not accessible
        }
      }
    } catch (error: any) {
      IPC.log("SharePoint site data not accessible", "warn");
    }

    IPC.log(`Owned SharePoint sites: ${ownedSites.length}`, "info");

    // Step 9: Generate comprehensive report
    IPC.progress("Generating comprehensive report...", 90);

    // User Profile Summary
    IPC.success({
      message: `User Profile - ${user.displayName}`,
      table: {
        headers: ["Property", "Value"],
        rows: [
          ["Email", user.userPrincipalName],
          ["Display Name", user.displayName || "N/A"],
          ["Job Title", user.jobTitle || "N/A"],
          ["Department", user.department || "N/A"],
          ["Account Status", user.accountEnabled ? "Enabled" : "Disabled"],
          [
            "Created",
            user.createdDateTime
              ? new Date(user.createdDateTime).toISOString().split("T")[0]
              : "N/A",
          ],
          ["Licenses", user.assignedLicenses?.length?.toString() || "0"],
        ],
      },
    });

    // Group Memberships
    if (groupCount > 0) {
      IPC.success({
        message: `Group Memberships (${groupCount})`,
        table: {
          headers: ["Group Name", "Group Type"],
          rows: groups.value.slice(0, 10).map((g: any) => [
            g.displayName || "Unknown",
            g["@odata.type"]?.includes("group") ? "Group" : "Other",
          ]),
        },
      });
      if (groupCount > 10) {
        IPC.log(`... and ${groupCount - 10} more groups`, "info");
      }
    } else {
      IPC.log("No group memberships", "info");
    }

    // Owned Devices
    if (deviceCount > 0) {
      IPC.success({
        message: `Owned Devices (${deviceCount})`,
        table: {
          headers: ["Device Name", "OS", "Model"],
          rows: devices.value.slice(0, 10).map((d: any) => [
            d.displayName || "Unknown",
            d.operatingSystem || "N/A",
            d.model || "N/A",
          ]),
        },
      });
    } else {
      IPC.log("No owned devices", "info");
    }

    // OneDrive Files
    if (oneDriveFiles.length > 0) {
      IPC.success({
        message: `OneDrive Top Files (${storageUsedGb}GB total)`,
        table: {
          headers: ["File Name", "Size (MB)", "Modified"],
          rows: oneDriveFiles.slice(0, 10).map((f: any) => [
            f.name?.length > 40 ? f.name.substring(0, 37) + "..." : f.name || "Unknown",
            ((f.size || 0) / (1024 * 1024)).toFixed(2),
            f.lastModifiedDateTime
              ? new Date(f.lastModifiedDateTime).toISOString().split("T")[0]
              : "N/A",
          ]),
        },
      });
    } else {
      IPC.log("No OneDrive files or OneDrive not provisioned", "info");
    }

    // Teams Memberships
    if (teams.length > 0) {
      IPC.success({
        message: `Teams Memberships (${teams.length})`,
        table: {
          headers: ["Team Name", "Description"],
          rows: teams.slice(0, 10).map((t: any) => [
            t.displayName || "Unknown",
            (t.description || "N/A").length > 50
              ? t.description.substring(0, 47) + "..."
              : t.description || "N/A",
          ]),
        },
      });
      if (teams.length > 10) {
        IPC.log(`... and ${teams.length - 10} more teams`, "info");
      }
    } else {
      IPC.log("No Teams memberships", "info");
    }

    // Mail Rules
    if (mailRules.length > 0) {
      IPC.success({
        message: `Mail Rules (${mailRules.length})`,
        table: {
          headers: ["Rule Name", "Enabled"],
          rows: mailRules.slice(0, 10).map((r: any) => [
            r.displayName || "Unknown",
            r.isEnabled ? "Yes" : "No",
          ]),
        },
      });
    } else {
      IPC.log("No mail rules configured", "info");
    }

    // Calendar Delegates
    if (calendarDelegates.length > 0) {
      IPC.success({
        message: `Calendar Delegates (${calendarDelegates.length})`,
        table: {
          headers: ["Delegate", "Permission Level"],
          rows: calendarDelegates.slice(0, 10).map((d: any) => [
            d.emailAddress?.address || d.emailAddress?.name || "Unknown",
            d.role || "Unknown",
          ]),
        },
      });
    } else {
      IPC.log("No calendar delegates", "info");
    }

    // SharePoint Sites
    if (ownedSites.length > 0) {
      IPC.success({
        message: `Owned SharePoint Sites (${ownedSites.length})`,
        table: {
          headers: ["Site Name", "URL"],
          rows: ownedSites.map((s: any) => [
            s.displayName || "Unknown",
            s.webUrl?.length > 50 ? s.webUrl.substring(0, 47) + "..." : s.webUrl || "N/A",
          ]),
        },
      });
    } else {
      IPC.log("No owned SharePoint sites found in sample", "info");
    }

    // Pre-Offboarding Recommendations
    IPC.log("\nPre-Offboarding Recommendations:", "info");
    if (groupCount > 0) {
      IPC.log(`1. Review ${groupCount} group memberships - remove from ${groupCount} groups`, "warn");
    }
    if (deviceCount > 0) {
      IPC.log(`2. ${deviceCount} devices need wipe/retire action`, "warn");
    }
    if (storageUsedGb !== "N/A" && parseFloat(storageUsedGb) > 5) {
      IPC.log(`3. OneDrive: ${storageUsedGb}GB - backup or reassign before deletion`, "warn");
    }
    if (teams.length > 0) {
      IPC.log(`4. ${teams.length} Teams memberships - reassign ownership if user is owner`, "warn");
    }
    if (mailRules.length > 0) {
      IPC.log(`5. ${mailRules.length} mail rules will be lost - document or recreate`, "info");
    }
    if (calendarDelegates.length > 0) {
      IPC.log(`6. ${calendarDelegates.length} calendar delegates - notify affected users`, "info");
    }
    if (ownedSites.length > 0) {
      IPC.log(`7. ${ownedSites.length} SharePoint sites - reassign ownership`, "error");
    }
    IPC.log("\nUse iam:offboard module to execute graceful offboarding with these insights", "info");
  } catch (error: any) {
    IPC.error(`User analysis failed: ${error.message}`);
  }
}
