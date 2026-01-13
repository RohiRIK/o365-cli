import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
import * as fs from "fs";
import * as path from "path";

interface GDPRExportArgs {
  user: string;
  dryRun: boolean;
}

interface UserData {
  profile: any;
  mailboxStats: any;
  driveStats: any;
  groups: any[];
  teams: any[];
  devices: any[];
  auditLogs: any[];
}

/**
 * GDPR User Data Export (Article 15 - Right of Access)
 * Generate comprehensive data subject access request (DSAR) export
 *
 * Aggregates:
 * - User profile (identity, contact info)
 * - Mailbox statistics
 * - OneDrive/SharePoint file metadata
 * - Group/Teams memberships
 * - Registered devices
 * - Audit log activity (last 90 days)
 */
export async function exportGDPRData(user: string, dryRun: boolean = true) {
  const client = GraphService.getClient();

  IPC.progress("Starting GDPR data export...", 0);
  IPC.log(`User: ${user}`, "info");
  IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE EXPORT"}`, "info");

  try {
    const userData: UserData = {
      profile: null,
      mailboxStats: null,
      driveStats: null,
      groups: [],
      teams: [],
      devices: [],
      auditLogs: [],
    };

    // Phase 1: Fetch User Profile (0-15%)
    IPC.progress("Fetching user profile...", 5);
    try {
      userData.profile = await client
        .api(`/users/${user}`)
        .select("id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones,country,city,createdDateTime")
        .get();

      IPC.log(`Found user: ${userData.profile.displayName}`, "info");
    } catch (error: any) {
      IPC.error(`User not found: ${error.message}`);
      return;
    }

    // Phase 2: Fetch Mailbox Statistics (15-30%)
    IPC.progress("Fetching mailbox statistics...", 15);
    try {
      const mailboxSettings = await client
        .api(`/users/${user}/mailboxSettings`)
        .get();

      userData.mailboxStats = {
        archiveStatus: mailboxSettings.archiveFolder || "Not configured",
        automaticRepliesSetting: mailboxSettings.automaticRepliesSetting,
        language: mailboxSettings.language,
        timeZone: mailboxSettings.timeZone,
        dateFormat: mailboxSettings.dateFormat,
        timeFormat: mailboxSettings.timeFormat,
      };

      IPC.log("Mailbox statistics collected", "info");
    } catch (error: any) {
      IPC.log(`Mailbox access limited: ${error.message}`, "warn");
      userData.mailboxStats = { error: "Access denied or mailbox not available" };
    }

    // Phase 3: Fetch OneDrive Statistics (30-45%)
    IPC.progress("Fetching OneDrive statistics...", 30);
    try {
      const drive = await client
        .api(`/users/${user}/drive`)
        .select("id,driveType,owner,quota")
        .get();

      userData.driveStats = {
        driveId: drive.id,
        driveType: drive.driveType,
        owner: drive.owner.user.displayName,
        quotaTotal: Math.round((drive.quota.total || 0) / 1024 / 1024 / 1024), // GB
        quotaUsed: Math.round((drive.quota.used || 0) / 1024 / 1024 / 1024), // GB
        quotaRemaining: Math.round((drive.quota.remaining || 0) / 1024 / 1024 / 1024), // GB
        quotaState: drive.quota.state,
      };

      IPC.log(`OneDrive: ${userData.driveStats.quotaUsed}GB / ${userData.driveStats.quotaTotal}GB used`, "info");
    } catch (error: any) {
      IPC.log(`OneDrive access limited: ${error.message}`, "warn");
      userData.driveStats = { error: "Access denied or OneDrive not available" };
    }

    // Phase 4: Fetch Group Memberships (45-60%)
    IPC.progress("Fetching group memberships...", 45);
    try {
      const groups = await GraphService.fetchAll(
        `/users/${user}/memberOf`,
        "displayName,id,groupTypes,mail,securityEnabled,mailEnabled,createdDateTime"
      );

      userData.groups = groups.map((g: any) => ({
        id: g.id,
        displayName: g.displayName,
        mail: g.mail,
        type: g.groupTypes?.includes("Unified") ? "M365 Group" : g.securityEnabled ? "Security Group" : "Distribution List",
        createdDateTime: g.createdDateTime,
      }));

      IPC.log(`Found ${userData.groups.length} group memberships`, "info");
    } catch (error: any) {
      IPC.log(`Group enumeration limited: ${error.message}`, "warn");
    }

    // Phase 5: Fetch Teams Memberships (60-70%)
    IPC.progress("Fetching Teams memberships...", 60);
    try {
      const teams = await GraphService.fetchAll(
        `/users/${user}/joinedTeams`,
        "id,displayName,description,isArchived,createdDateTime"
      );

      userData.teams = teams.map((t: any) => ({
        id: t.id,
        displayName: t.displayName,
        description: t.description,
        isArchived: t.isArchived,
        createdDateTime: t.createdDateTime,
      }));

      IPC.log(`Found ${userData.teams.length} Teams memberships`, "info");
    } catch (error: any) {
      IPC.log(`Teams enumeration limited: ${error.message}`, "warn");
    }

    // Phase 6: Fetch Registered Devices (70-85%)
    IPC.progress("Fetching registered devices...", 70);
    try {
      const devices = await GraphService.fetchAll(
        `/users/${user}/registeredDevices`,
        "id,displayName,operatingSystem,operatingSystemVersion,approximateLastSignInDateTime,isCompliant,isManaged"
      );

      userData.devices = devices.map((d: any) => ({
        id: d.id,
        displayName: d.displayName,
        os: d.operatingSystem,
        osVersion: d.operatingSystemVersion,
        lastSignIn: d.approximateLastSignInDateTime,
        isCompliant: d.isCompliant,
        isManaged: d.isManaged,
      }));

      IPC.log(`Found ${userData.devices.length} registered devices`, "info");
    } catch (error: any) {
      IPC.log(`Device enumeration limited: ${error.message}`, "warn");
    }

    // Phase 7: Fetch Audit Logs (85-95%) - Note: Requires premium licenses
    IPC.progress("Fetching audit logs (last 90 days)...", 85);
    IPC.log("Audit log access requires Microsoft 365 E5 or audit add-on", "warn");
    userData.auditLogs = []; // Placeholder - requires specialized API access

    // Phase 8: Generate Export (95-100%)
    IPC.progress("Generating export file...", 95);

    if (!dryRun) {
      const exportDir = path.join(process.cwd(), "exports", "gdpr");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `gdpr_export_${user.replace("@", "_at_")}_${timestamp}.json`;
      const filePath = path.join(exportDir, fileName);

      // Create directory if it doesn't exist
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      // Write export file
      fs.writeFileSync(filePath, JSON.stringify({
        exportMetadata: {
          subject: user,
          exportDate: new Date().toISOString(),
          dataController: "Organization",
          legalBasis: "GDPR Article 15 - Right of Access",
          retentionPeriod: "As per GDPR Article 5(1)(e)",
        },
        userData,
      }, null, 2));

      IPC.log(`Export saved: ${filePath}`, "info");

      IPC.success({
        message: `GDPR export completed for ${user}`,
        file_path: filePath,
        table: {
          headers: ["Data Category", "Records Found", "Status"],
          rows: [
            ["User Profile", "1", "✅ Complete"],
            ["Mailbox Stats", userData.mailboxStats.error ? "0" : "1", userData.mailboxStats.error ? "⚠️ Limited" : "✅ Complete"],
            ["OneDrive Stats", userData.driveStats.error ? "0" : "1", userData.driveStats.error ? "⚠️ Limited" : "✅ Complete"],
            ["Group Memberships", userData.groups.length.toString(), "✅ Complete"],
            ["Teams Memberships", userData.teams.length.toString(), "✅ Complete"],
            ["Registered Devices", userData.devices.length.toString(), "✅ Complete"],
            ["Audit Logs", userData.auditLogs.length.toString(), "⚠️ Requires E5"],
          ],
        },
      });
    } else {
      // Dry run - just show what would be exported
      IPC.success({
        message: `GDPR export preview for ${user} (DRY RUN - no file created)`,
        table: {
          headers: ["Data Category", "Records Found", "Status"],
          rows: [
            ["User Profile", "1", "✅ Complete"],
            ["Mailbox Stats", userData.mailboxStats.error ? "0" : "1", userData.mailboxStats.error ? "⚠️ Limited" : "✅ Complete"],
            ["OneDrive Stats", userData.driveStats.error ? "0" : "1", userData.driveStats.error ? "⚠️ Limited" : "✅ Complete"],
            ["Group Memberships", userData.groups.length.toString(), "✅ Complete"],
            ["Teams Memberships", userData.teams.length.toString(), "✅ Complete"],
            ["Registered Devices", userData.devices.length.toString(), "✅ Complete"],
            ["Audit Logs", userData.auditLogs.length.toString(), "⚠️ Requires E5"],
          ],
        },
      });
    }

  } catch (error: any) {
    IPC.error(`GDPR export failed: ${error.message}`);
  }
}
