import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
import * as fs from "fs";
import * as path from "path";

// TODO: Move to external config
const HIGH_RISK_SCOPES = [
  "Mail.Read",
  "Mail.ReadWrite",
  "Files.Read.All",
  "Files.ReadWrite.All",
  "Directory.ReadWrite.All",
  "User.ReadWrite.All"
];

// TODO: Add your approved Enterprise App IDs here
const WHITELISTED_APP_IDS: string[] = [
  "00000003-0000-0000-c000-000000000000", // Microsoft Graph
  "2e6c0c2d-9488-4453-86c5-44223202534a", // Zoom (Example)
  "5e3ce6c0-2b1f-4285-8d4b-75ee78787346"  // Slack (Example)
];

interface Grant {
  id: string;
  clientId: string; // Service Principal ObjectId
  principalId: string; // User ObjectId
  scope: string;
  startTime: string; // GrantStart
  expiryTime: string; // GrantExpiry
  consentType: string;
}

interface ServicePrincipal {
  id: string;
  appId: string;
  displayName: string;
  publisherName: string | null;
  homepage: string | null;
  replyUrls: string[];
  passwordCredentials: any[];
  keyCredentials: any[];
}

interface User {
  id: string;
  displayName: string;
  userPrincipalName: string;
  jobTitle: string | null;
  department: string | null;
  signInActivity: { lastSignInDateTime: string } | null;
}

interface RiskyGrant {
    grantId: string;
    appName: string;
    appId: string;
    publisher: string;
    homepage: string;
    replyUrls: string;
    secretStatus: string;
    certStatus: string;
    credentialHealth: string;
    user: string;
    userDisplayName: string;
    jobTitle: string;
    department: string;
    manager: string;
    lastSignIn: string;
    grantStart: string;
    grantExpiry: string;
    scopes: string; // All scopes
    riskyScopes: string; // Only the bad ones
}

export async function analyzeShadowIT(dryRun: boolean = true) {
  IPC.progress("Starting Shadow IT Audit...", 0);
  const client = GraphService.getClient();

  try {
    // 1. Fetch all User Consents
    IPC.progress("Fetching OAuth2 Permission Grants...", 10);
    const grantsReq = await client.api("/oauth2PermissionGrants").get();
    const grants: Grant[] = grantsReq.value;

    IPC.progress(`Analying ${grants.length} grants...`, 20);

    // Cache for lookups to avoid N+1 API calls
    const appCache = new Map<string, ServicePrincipal>();
    const userCache = new Map<string, User>();
    const managerCache = new Map<string, string>(); // UserId -> ManagerEmail

    const riskyGrants: RiskyGrant[] = [];

    for (const grant of grants) {
      // Check for High Risk Scopes
      const scopeList = grant.scope.split(" ");
      const riskyScopeList = scopeList.filter(s => HIGH_RISK_SCOPES.includes(s));

      if (riskyScopeList.length === 0) continue;

      // 2. Resolve Application Details
      let app = appCache.get(grant.clientId);
      if (!app) {
        try {
          const sp = await client.api(`/servicePrincipals/${grant.clientId}`)
            .select("id,appId,displayName,publisherName,homepage,replyUrls,passwordCredentials,keyCredentials")
            .get();
          
          app = { 
              id: sp.id, 
              appId: sp.appId, 
              displayName: sp.displayName,
              publisherName: sp.publisherName,
              homepage: sp.homepage,
              replyUrls: sp.replyUrls,
              passwordCredentials: sp.passwordCredentials,
              keyCredentials: sp.keyCredentials
          };
          appCache.set(grant.clientId, app);
        } catch (e) {
          continue; // App might be deleted
        }
      }

      // Skip Whitelisted Apps
      if (WHITELISTED_APP_IDS.includes(app.appId)) continue;

      // 3. Resolve User Details
      let user = userCache.get(grant.principalId);
      if (!user) {
        try {
          // For Admin Consent (PrincipalId is null or empty), handle gracefully
          if (!grant.principalId) {
             user = { id: "admin", displayName: "Organization Wide", userPrincipalName: "All Users", jobTitle: "N/A", department: "N/A", signInActivity: null };
          } else {
             const u = await client.api(`/users/${grant.principalId}`)
                .select("id,displayName,userPrincipalName,jobTitle,department,signInActivity")
                .get();
             user = { 
                 id: u.id, 
                 displayName: u.displayName, 
                 userPrincipalName: u.userPrincipalName,
                 jobTitle: u.jobTitle,
                 department: u.department,
                 signInActivity: u.signInActivity
             };
             userCache.set(grant.principalId, user);
          }
        } catch (e) {
            // User might be deleted or it's a system principal
            user = { id: grant.principalId, displayName: "Unknown/Deleted", userPrincipalName: "N/A", jobTitle: "N/A", department: "N/A", signInActivity: null };
        }
      }

      // 4. Resolve Manager (Lazy Load)
      let managerEmail = "N/A";
      if (user.id !== "admin" && user.id !== grant.principalId) { // Only fetch if real user
          if (managerCache.has(user.id)) {
              managerEmail = managerCache.get(user.id)!;
          } else {
              try {
                  const mgr = await client.api(`/users/${user.id}/manager`)
                    .select("mail,userPrincipalName")
                    .get();
                  managerEmail = mgr.mail || mgr.userPrincipalName || "N/A";
                  managerCache.set(user.id, managerEmail);
              } catch (e) {
                  managerEmail = "No Manager";
                  managerCache.set(user.id, managerEmail);
              }
          }
      }

      // 5. Analyze Credential Health
      const now = new Date();
      const warningWindow = new Date();
      warningWindow.setDate(now.getDate() + 30); // 30 days warning

      const allCreds = [...(app.passwordCredentials || []), ...(app.keyCredentials || [])];
      let credHealth = "None";

      if (allCreds.length > 0) {
          // Find the latest expiration date (the date the app will stop working)
          const maxExpiry = allCreds.reduce((latest, current) => {
              const currentEnd = new Date(current.endDateTime);
              return currentEnd > latest ? currentEnd : latest;
          }, new Date(0)); 

          if (maxExpiry < now) {
              credHealth = "ALL EXPIRED";
          } else if (maxExpiry < warningWindow) {
              const daysLeft = Math.ceil((maxExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              credHealth = `EXPIRING SOON (${daysLeft} days)`;
          } else {
              credHealth = "Healthy";
          }
      }

      const secretStatus = app.passwordCredentials?.length > 0 ? `Valid (${app.passwordCredentials.length})` : "None";
      const certStatus = app.keyCredentials?.length > 0 ? `Valid (${app.keyCredentials.length})` : "None";
      const lastSignIn = user.signInActivity?.lastSignInDateTime || "N/A";

      riskyGrants.push({
        grantId: grant.id,
        appName: app.displayName,
        appId: app.appId,
        publisher: app.publisherName || "Unverified",
        homepage: app.homepage || "N/A",
        replyUrls: app.replyUrls ? app.replyUrls.join("; ") : "N/A",
        secretStatus,
        certStatus,
        credentialHealth: credHealth,
        user: user.userPrincipalName,
        userDisplayName: user.displayName,
        jobTitle: user.jobTitle || "N/A",
        department: user.department || "N/A",
        manager: managerEmail,
        lastSignIn,
        grantStart: grant.startTime,
        grantExpiry: grant.expiryTime || "Never",
        scopes: grant.scope,
        riskyScopes: riskyScopeList.join(" ")
      });
    }

    // 4. Report & Remediate
    if (riskyGrants.length === 0) {
      IPC.success({ message: "No risky Shadow IT detected." });
      return;
    }

    IPC.progress(`Found ${riskyGrants.length} risky grants.`, 90);

    // Generate CSV
    const csvHeader = "DetectedDate,Action,AppName,CredentialHealth,AppId,Publisher,VerifiedPub,Homepage,ReplyUrls,SecretStatus,CertStatus,UserUPN,UserDisplayName,JobTitle,Department,Manager,LastSignIn,GrantStart,GrantExpiry,RiskyScopes,AllScopes\n";
    const detectedDate = new Date().toISOString().split('T')[0];
    const action = dryRun ? "Audit Only" : "Revoked";

    const csvRows = riskyGrants.map(g => {
        return [
            detectedDate,
            action,
            `"${g.appName}"`, 
            `"${g.credentialHealth}"`,
            `"${g.appId}"`, 
            `"${g.publisher}"`, 
            `"${g.publisher !== 'Unverified' ? 'Yes' : 'No'}"`, 
            `"${g.homepage}"`, 
            `"${g.replyUrls}"`, 
            `"${g.secretStatus}"`, 
            `"${g.certStatus}"`, 
            `"${g.user}"`, 
            `"${g.userDisplayName}"`, 
            `"${g.jobTitle}"`, 
            `"${g.department}"`, 
            `"${g.manager}"`, 
            `"${g.lastSignIn}"`, 
            `"${g.grantStart}"`, 
            `"${g.grantExpiry}"`, 
            `"${g.riskyScopes}"`,
            `"${g.scopes}"`
        ].join(",");
    }).join("\n");

    const fileName = `shadow_it_report_${Date.now()}.csv`;
    const filePath = path.resolve(process.cwd(), fileName);
    fs.writeFileSync(filePath, csvHeader + csvRows);

    // Prepare Table Data for Rust
    const tableRows = riskyGrants.map(g => [
        g.appName, 
        g.credentialHealth, 
        g.publisher,
        g.user, 
        g.department, // Added Department
        g.riskyScopes // Shows ONLY the risky ones
    ]);

    const successPayload = {
        message: dryRun ? "Audit Complete (Dry Run)" : "Remediation Complete",
        file_path: filePath,
        table: {
            headers: ["App Name", "Creds Health", "Publisher", "User", "Dept", "Risky Scopes"],
            rows: tableRows
        }
    };

    if (dryRun) {
      IPC.success(successPayload);
    } else {
      IPC.progress("Remediating (Revoking Grants)...", 95);
      for (const item of riskyGrants) {
         try {
             await client.api(`/oauth2PermissionGrants/${item.grantId}`).delete();
             console.log(JSON.stringify({ type: 'progress', message: `Revoked access for ${item.appName} on ${item.user}` }));
         } catch (e: any) {
             IPC.error(`Failed to revoke ${item.grantId}: ${e.message}`);
         }
      }
      IPC.success(successPayload);
    }

  } catch (error: any) {
    IPC.error(error.message || "Unknown Error during Shadow IT Scan");
  }
}