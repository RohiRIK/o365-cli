import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

// TODO: Move to external config
const HIGH_RISK_SCOPES = [
  // Mail (Critical)
  "Mail.Read", "Mail.ReadWrite", "Mail.Send", "MailboxSettings.ReadWrite",
  // Files (Critical)
  "Files.Read.All", "Files.ReadWrite.All", "Sites.ReadWrite.All", "Sites.Manage.All",
  // Directory (Critical)
  "Directory.ReadWrite.All", "Directory.AccessAsUser.All",
  "User.ReadWrite.All", "Group.ReadWrite.All",
  // Roles (Critical)
  "RoleManagement.ReadWrite.Directory", "AppRoleAssignment.ReadWrite.All",
  // Identity (High)
  "IdentityRiskEvent.ReadWrite.All", "Policy.ReadWrite.ConditionalAccess",
  // Device (High)
  "Device.ReadWrite.All", "DeviceManagementConfiguration.ReadWrite.All",
  // Audit Logs (Medium)
  "AuditLog.Read.All", "SecurityEvents.ReadWrite.All",
  // Offline Access
  "offline_access"
];

const WILDCARD_PATTERNS = [
  /\.All$/,           // Ends with .All
  /^Mail\./,          // Starts with Mail.
  /^Files\./,         // Starts with Files.
  /^Directory\./,     // Starts with Directory.
  /^User\./,          // Starts with User.
  /\*$/               // Literal asterisk
];

const MICROSOFT_FIRST_PARTY_ORG_ID = "f8cdef31-a31e-4b4a-93e4-5f571e91255a";

// Microsoft's official permission classifications
const PERMISSION_SEVERITY = {
  CRITICAL: [
    "Directory.ReadWrite.All",        // Highest privileged - can modify entire directory
    "Directory.AccessAsUser.All",     // Nearly all operations across Entra ID
    "RoleManagement.ReadWrite.Directory", // Can assign admin roles
    "AppRoleAssignment.ReadWrite.All", // Can grant itself more permissions
    "Application.ReadWrite.All",      // Can modify app registrations
    "Domain.ReadWrite.All",           // Can modify domain configuration
  ],
  HIGH: [
    "Mail.ReadWrite",                 // Read/write all user email
    "Mail.Send",                      // Send email as any user
    "MailboxSettings.ReadWrite",      // Modify mailbox settings
    "Files.ReadWrite.All",            // Read/write all files
    "Sites.ReadWrite.All",            // Modify all SharePoint sites
    "User.ReadWrite.All",             // Modify all users
    "Group.ReadWrite.All",            // Modify all groups
    "Device.ReadWrite.All",           // Modify all devices
    "Policy.ReadWrite.ConditionalAccess", // Modify security policies
    "IdentityRiskEvent.ReadWrite.All", // Modify risk events
  ],
  MEDIUM: [
    "Mail.Read",                      // Read all email (read-only)
    "Files.Read.All",                 // Read all files (read-only)
    "Directory.Read.All",             // Read directory (read-only)
    "User.Read.All",                  // Read all users
    "Contacts.ReadWrite",             // Modify contacts
    "Calendars.ReadWrite",            // Modify calendars
    "Notes.Read.All",                 // Read all OneNote notebooks
    "Sites.Manage.All",               // Manage site collections
  ],
  LOW: [
    "User.Read",                      // Read own profile (common)
    "Contacts.Read",                  // Read own contacts
    "Calendars.Read",                 // Read own calendar
    "Files.Read",                     // Read own files
    "Mail.Read.Shared",               // Read shared mail (user scope)
  ]
};

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
    grantType: "Delegated" | "Application";
    appName: string;
    appId: string;
    publisher: string;
    publisherVerified: boolean;
    appOwnerType: "Microsoft" | "Internal" | "ThirdParty";
    homepage: string;
    replyUrls: string;
    secretStatus: string;
    certStatus: string;
    credentialHealth: string;
    hasWildcardPermissions: boolean;
    hasOfflineAccess: boolean;
    riskScore: number;
    riskLevel: "Critical" | "High" | "Medium" | "Low";
    permissionSeverity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MIXED"; // NEW
    recommendation: string; // NEW
    user: string;
    userDisplayName: string;
    userEnabled: boolean;
    userType: string;
    jobTitle: string;
    department: string;
    manager: string;
    lastSignIn: string;
    daysSinceLastSignIn: number;
    grantStart: string;
    grantExpiry: string;
    consentType: string;
    scopes: string;
    riskyScopes: string;
}

// Helper: Calculate risk score
function calculateRiskScore(
  riskyScopes: string[],
  hasWildcard: boolean,
  hasOffline: boolean,
  publisherVerified: boolean,
  appOwnerType: string,
  credHealth: string,
  daysSinceLastSignIn: number,
  userEnabled: boolean,
  userType: string,
  consentType: string
): number {
  let score = 0;
  
  // Permission Severity (0-40 points)
  if (hasWildcard) score += 20;
  if (riskyScopes.some(s => s.includes("Directory.ReadWrite.All"))) score += 15;
  if (riskyScopes.some(s => s.includes("Mail.Read") || s.includes("Files.Read.All"))) score += 10;
  if (hasOffline) score += 5;
  
  // Publisher Trust (0-25 points)
  if (!publisherVerified) score += 15;
  if (appOwnerType === "ThirdParty") score += 10;
  
  // Credential Hygiene (0-15 points)
  if (credHealth.includes("EXPIRED")) score += 10;
  if (credHealth.includes("EXPIRING")) score += 5;
  
  // User Context (0-20 points)
  if (daysSinceLastSignIn > 180) score += 10; // Zombie grant
  if (!userEnabled) score += 5;
  if (userType === "Guest") score += 5;
  
  // Consent Scope (0-10 points)
  if (consentType === "AllPrincipals") score += 10; // Tenant-wide
  
  return Math.min(score, 100);
}

// Helper: Get risk level
function getRiskLevel(score: number): "Critical" | "High" | "Medium" | "Low" {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

// Helper: Get tenant ID (cached)
let cachedTenantId: string = "";
async function getTenantId(client: any): Promise<string> {
  if (cachedTenantId) return cachedTenantId;
  try {
    const org = await client.api("/organization").select("id").get();
    cachedTenantId = org.value[0].id;
    return cachedTenantId;
  } catch {
    return "unknown";
  }
}

// Helper: Classify permission severity
function classifyPermissions(permissions: string[]): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MIXED" {
  try {
    if (!permissions || permissions.length === 0) return "LOW";
    
    let hasCritical = false;
    let hasHigh = false;
    let hasMedium = false;
    
    for (const perm of permissions) {
      if (!perm) continue;
      if (PERMISSION_SEVERITY.CRITICAL.includes(perm)) hasCritical = true;
      else if (PERMISSION_SEVERITY.HIGH.includes(perm)) hasHigh = true;
      else if (PERMISSION_SEVERITY.MEDIUM.includes(perm)) hasMedium = true;
    }
    
    // If multiple severity levels, return MIXED
    const severityCount = [hasCritical, hasHigh, hasMedium].filter(Boolean).length;
    if (severityCount > 1) return "MIXED";
    
    if (hasCritical) return "CRITICAL";
    if (hasHigh) return "HIGH";
    if (hasMedium) return "MEDIUM";
    return "LOW";
  } catch (e) {
    return "LOW";
  }
}

// Helper: Generate recommendation
function generateRecommendation(grant: Partial<RiskyGrant>): string {
  const recommendations: string[] = [];
  
  try {
    // Permission-based recommendations
    if (grant.permissionSeverity === "CRITICAL") {
      recommendations.push("🚨 IMMEDIATE ACTION: Critical permissions detected");
    } else if (grant.permissionSeverity === "HIGH") {
      recommendations.push("⚠️ Review: High-privileged access");
    }
    
    // Publisher trust
    if (grant.publisherVerified === false && grant.appOwnerType === "ThirdParty") {
      recommendations.push("Unverified third-party - verify legitimacy");
    }
    
    // Credential hygiene
    if (grant.credentialHealth) {
      if (grant.credentialHealth.includes("EXPIRED")) {
        recommendations.push("Expired credentials - safe to revoke");
      } else if (grant.credentialHealth.includes("EXPIRING")) {
        recommendations.push("Credentials expiring soon");
      }
    }
    
    // Zombie grants
    if (grant.daysSinceLastSignIn && grant.daysSinceLastSignIn > 180) {
      const months = Math.floor(grant.daysSinceLastSignIn / 30);
      recommendations.push(`User inactive ${months}mo - review need`);
    }
    
    // Disabled users
    if (grant.userEnabled === false) {
      recommendations.push("User disabled - revoke immediately");
    }
    
    // Tenant-wide consent
    if (grant.consentType === "AllPrincipals" || grant.consentType === "Admin") {
      recommendations.push("Tenant-wide - high blast radius");
    }
    
    // Default if no specific concerns
    if (recommendations.length === 0) {
      return "Monitor for unusual activity";
    }
    
    return recommendations.slice(0, 2).join("; "); // Top 2 recommendations
  } catch (e) {
    return "Review required";
  }
}

export async function analyzeShadowIT(dryRun: boolean = true) {
  IPC.progress("Starting Enhanced Shadow IT Audit...", 0);
  const client = GraphService.getClient();

  try {
    // 1. Fetch all Delegated Permissions (User Consents)
    IPC.progress("Fetching OAuth2 Permission Grants (Delegated)...", 5);
    const grantsReq = await client.api("/oauth2PermissionGrants").get();
    const grants: Grant[] = grantsReq.value;

    // 2. Fetch all Application Permissions (Admin Consents)
    IPC.progress("Fetching Application Permissions (App Roles)...", 10);
    const allServicePrincipalsRaw = await client.api("/servicePrincipals")
      .select("id,appId,displayName,appOwnerOrganizationId")
      .top(999)
      .get();
    
    // Filter out Microsoft resource SPs immediately (Graph, Exchange, etc.)
    const allServicePrincipals = {
      value: allServicePrincipalsRaw.value.filter((sp: any) => 
        sp.appId && 
        !sp.appId.startsWith("00000") && // Skip Microsoft resource SPs
        sp.appOwnerOrganizationId !== MICROSOFT_FIRST_PARTY_ORG_ID // Skip Microsoft-owned apps
      )
    };
    
    IPC.progress(`Analyzing ${grants.length} delegated + application permissions...`, 15);

    // Cache for lookups to avoid N+1 API calls
    const appCache = new Map<string, ServicePrincipal>();
    const userCache = new Map<string, User>();
    const managerCache = new Map<string, string>(); // UserId -> ManagerEmail

    const riskyGrants: RiskyGrant[] = [];
    const now = new Date();
    let processedCount = 0;
    const totalItems = grants.length + allServicePrincipals.value.length;

    // === PART 1: Process Delegated Permissions ===
    for (const grant of grants) {
      processedCount++;
      if (processedCount % 10 === 0) {
        IPC.progress(`Processing delegated grants: ${processedCount}/${grants.length}`, 20 + (processedCount / totalItems) * 60);
      }
      // Check for High Risk Scopes
      const scopeList = grant.scope.split(" ");
      const riskyScopeList = scopeList.filter(s => HIGH_RISK_SCOPES.includes(s));

      if (riskyScopeList.length === 0) continue;

      // 2. Resolve Application Details (Enhanced)
      let app = appCache.get(grant.clientId);
      if (!app) {
        try {
          const sp = await client.api(`/servicePrincipals/${grant.clientId}`)
            .select("id,appId,displayName,publisherName,homepage,replyUrls,passwordCredentials,keyCredentials,verifiedPublisher,appOwnerOrganizationId,signInAudience")
            .get();
          
          const spData = { 
              id: sp.id, 
              appId: sp.appId, 
              displayName: sp.displayName,
              publisherName: sp.publisherName,
              homepage: sp.homepage,
              replyUrls: sp.replyUrls,
              passwordCredentials: sp.passwordCredentials,
              keyCredentials: sp.keyCredentials,
              verifiedPublisher: sp.verifiedPublisher,
              appOwnerOrganizationId: sp.appOwnerOrganizationId,
              signInAudience: sp.signInAudience
          } as ServicePrincipal;
          app = spData;
          appCache.set(grant.clientId, spData);
        } catch (e) {
          continue; // App might be deleted
        }
      }

      // Should never happen but TypeScript needs this
      if (!app) continue;
      
      // Skip Microsoft First-Party Apps
      if ((app as any).appOwnerOrganizationId === MICROSOFT_FIRST_PARTY_ORG_ID) continue;
      
      // Skip Whitelisted Apps
      if (WHITELISTED_APP_IDS.includes(app.appId)) continue;

      // 3. Resolve User Details (Enhanced with accountEnabled, userType)
      let user: any = userCache.get(grant.principalId);
      if (!user) {
        try {
          // For Admin Consent (PrincipalId is null or empty), handle gracefully
          if (!grant.principalId) {
             user = { 
               id: "admin", 
               displayName: "Organization Wide", 
               userPrincipalName: "All Users (Tenant-Wide)", 
               jobTitle: "N/A", 
               department: "N/A", 
               signInActivity: null,
               accountEnabled: true,
               userType: "N/A"
             };
          } else {
             const u = await client.api(`/users/${grant.principalId}`)
                .select("id,displayName,userPrincipalName,jobTitle,department,signInActivity,accountEnabled,userType")
                .get();
             user = { 
                 id: u.id, 
                 displayName: u.displayName, 
                 userPrincipalName: u.userPrincipalName,
                 jobTitle: u.jobTitle,
                 department: u.department,
                 signInActivity: u.signInActivity,
                 accountEnabled: u.accountEnabled ?? true,
                 userType: u.userType || "Member"
             };
             userCache.set(grant.principalId, user);
          }
        } catch (e) {
            // User might be deleted or it's a system principal
            user = { 
              id: grant.principalId, 
              displayName: "Unknown/Deleted", 
              userPrincipalName: "N/A", 
              jobTitle: "N/A", 
              department: "N/A", 
              signInActivity: null,
              accountEnabled: false,
              userType: "Unknown"
            };
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
      
      // Calculate days since last sign-in
      let daysSinceLastSignIn = 0;
      if (user.signInActivity?.lastSignInDateTime) {
        const lastSignInDate = new Date(user.signInActivity.lastSignInDateTime);
        daysSinceLastSignIn = Math.floor((now.getTime() - lastSignInDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      // Detect wildcards and offline_access
      const hasWildcardPermissions = WILDCARD_PATTERNS.some(pattern => riskyScopeList.some(scope => pattern.test(scope)));
      const hasOfflineAccess = riskyScopeList.includes("offline_access");
      
      // Determine app owner type
      const appOwnerType = 
        (app as any).appOwnerOrganizationId === MICROSOFT_FIRST_PARTY_ORG_ID ? "Microsoft" :
        (app as any).appOwnerOrganizationId === await getTenantId(client) ? "Internal" :
        "ThirdParty";
      
      const publisherVerified = !!(app as any).verifiedPublisher?.displayName;
      
      // Calculate risk score
      const riskScore = calculateRiskScore(
        riskyScopeList,
        hasWildcardPermissions,
        hasOfflineAccess,
        publisherVerified,
        appOwnerType,
        credHealth,
        daysSinceLastSignIn,
        user.accountEnabled,
        user.userType,
        grant.consentType
      );

      // Classify permissions and generate recommendation
      let permissionSeverity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MIXED" = "LOW";
      let recommendation = "Monitor for unusual activity";
      
      try {
        permissionSeverity = classifyPermissions(riskyScopeList);
        
        const grantData: Partial<RiskyGrant> = {
          appName: app.displayName,
          grantType: "Delegated",
          publisherVerified,
          appOwnerType,
          hasWildcardPermissions,
          hasOfflineAccess,
          riskScore,
          riskLevel: getRiskLevel(riskScore),
          permissionSeverity,
          userEnabled: user.accountEnabled,
          userType: user.userType,
          daysSinceLastSignIn,
          credentialHealth: credHealth,
          consentType: grant.consentType,
        };
        
        recommendation = generateRecommendation(grantData);
      } catch (e: any) {
        console.error(`[WARN] Failed to classify/recommend for ${app.displayName}: ${e.message}`);
      }

      riskyGrants.push({
        grantId: grant.id,
        grantType: "Delegated",
        appName: app.displayName,
        appId: app.appId,
        publisher: app.publisherName || "Unverified",
        publisherVerified,
        appOwnerType,
        homepage: app.homepage || "N/A",
        replyUrls: app.replyUrls ? app.replyUrls.join("; ") : "N/A",
        secretStatus,
        certStatus,
        credentialHealth: credHealth,
        hasWildcardPermissions,
        hasOfflineAccess,
        riskScore,
        riskLevel: getRiskLevel(riskScore),
        permissionSeverity,
        recommendation,
        user: user.userPrincipalName,
        userDisplayName: user.displayName,
        userEnabled: user.accountEnabled,
        userType: user.userType,
        jobTitle: user.jobTitle || "N/A",
        department: user.department || "N/A",
        manager: managerEmail,
        lastSignIn,
        daysSinceLastSignIn,
        grantStart: grant.startTime,
        grantExpiry: grant.expiryTime || "Never",
        consentType: grant.consentType,
        scopes: grant.scope,
        riskyScopes: riskyScopeList.join(" ")
      });
    }

    // === PART 2: Process Application Permissions (App Roles) ===
    IPC.progress("Scanning application permissions (admin consents)...", 80);
    
    // Already filtered at source to exclude Microsoft resource SPs
    IPC.progress(`Checking ${allServicePrincipals.value.length} service principals for risky app permissions...`, 80);
    
    for (const sp of allServicePrincipals.value) {
      try {
        processedCount++;
        if (processedCount % 5 === 0) {
          IPC.progress(`Processing app roles: ${processedCount - grants.length}/${allServicePrincipals.value.length}`, 80 + ((processedCount - grants.length) / allServicePrincipals.value.length) * 10);
        }

        const appRoleAssignments = await Promise.race([
          client.api(`/servicePrincipals/${sp.id}/appRoleAssignments`).get(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);
        
        if (appRoleAssignments.value.length === 0) continue;
        
        for (const assignment of appRoleAssignments.value) {
          // Get full service principal details (cached)
          let app = appCache.get(sp.id);
          if (!app) {
            const spDetails = await client.api(`/servicePrincipals/${sp.id}`)
              .select("id,appId,displayName,publisherName,homepage,replyUrls,passwordCredentials,keyCredentials,verifiedPublisher,appOwnerOrganizationId,signInAudience")
              .get();
            const spData = spDetails as ServicePrincipal;
            app = spData;
            appCache.set(sp.id, spData);
          }
          
          // Should never happen but TypeScript needs this
          if (!app) continue;
          
          // Skip Microsoft first-party
          if ((app as any).appOwnerOrganizationId === MICROSOFT_FIRST_PARTY_ORG_ID) continue;
          if (WHITELISTED_APP_IDS.includes(app.appId)) continue;
          
          // Get resource (API) service principal to resolve permission names
          const resourceSP = await client.api(`/servicePrincipals/${assignment.resourceId}`)
            .select("appRoles")
            .get();
          
          const appRole = resourceSP.appRoles?.find((role: any) => role.id === assignment.appRoleId);
          const permissionValue = appRole?.value || "Unknown";
          
          // Check if risky
          if (!HIGH_RISK_SCOPES.includes(permissionValue) && 
              !WILDCARD_PATTERNS.some(p => p.test(permissionValue))) {
            continue;
          }
          
          // Analyze credentials
          const allCreds = [...(app.passwordCredentials || []), ...(app.keyCredentials || [])];
          let credHealth = "None";
          if (allCreds.length > 0) {
            const maxExpiry = allCreds.reduce((latest, current) => {
              const currentEnd = new Date(current.endDateTime);
              return currentEnd > latest ? currentEnd : latest;
            }, new Date(0));
            const warningWindow = new Date();
            warningWindow.setDate(warningWindow.getDate() + 30);
            if (maxExpiry < now) credHealth = "ALL EXPIRED";
            else if (maxExpiry < warningWindow) credHealth = `EXPIRING SOON`;
            else credHealth = "Healthy";
          }
          
          const hasWildcard = WILDCARD_PATTERNS.some(p => p.test(permissionValue));
          const publisherVerified = !!(app as any).verifiedPublisher?.displayName;
          const appOwnerType = 
            (app as any).appOwnerOrganizationId === MICROSOFT_FIRST_PARTY_ORG_ID ? "Microsoft" :
            (app as any).appOwnerOrganizationId === await getTenantId(client) ? "Internal" :
            "ThirdParty";
          
          const riskScore = calculateRiskScore(
            [permissionValue],
            hasWildcard,
            false,
            publisherVerified,
            appOwnerType,
            credHealth,
            0, // No user context for app permissions
            true,
            "N/A",
            "Admin"
          );
          
          // Classify permissions and generate recommendation
          let permissionSeverity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MIXED" = "LOW";
          let recommendation = "Monitor for unusual activity";
          
          try {
            permissionSeverity = classifyPermissions([permissionValue]);
            
            const grantData: Partial<RiskyGrant> = {
              appName: app.displayName,
              grantType: "Application",
              publisherVerified,
              appOwnerType,
              hasWildcardPermissions: hasWildcard,
              hasOfflineAccess: false,
              riskScore,
              riskLevel: getRiskLevel(riskScore),
              permissionSeverity,
              userEnabled: true,
              userType: "N/A",
              daysSinceLastSignIn: 0,
              credentialHealth: credHealth,
              consentType: "Admin",
            };
            
            recommendation = generateRecommendation(grantData);
          } catch (e: any) {
            console.error(`[WARN] Failed to classify/recommend for ${app.displayName}: ${e.message}`);
          }
          
          riskyGrants.push({
            grantId: assignment.id,
            grantType: "Application",
            appName: app.displayName,
            appId: app.appId,
            publisher: app.publisherName || "Unverified",
            publisherVerified,
            appOwnerType,
            homepage: app.homepage || "N/A",
            replyUrls: app.replyUrls ? app.replyUrls.join("; ") : "N/A",
            secretStatus: app.passwordCredentials?.length > 0 ? `Valid (${app.passwordCredentials.length})` : "None",
            certStatus: app.keyCredentials?.length > 0 ? `Valid (${app.keyCredentials.length})` : "None",
            credentialHealth: credHealth,
            hasWildcardPermissions: hasWildcard,
            hasOfflineAccess: false,
            riskScore,
            riskLevel: getRiskLevel(riskScore),
            permissionSeverity,
            recommendation,
            user: "Tenant-Wide (App-Only)",
            userDisplayName: "Admin Consent",
            userEnabled: true,
            userType: "N/A",
            jobTitle: "N/A",
            department: "N/A",
            manager: "N/A",
            lastSignIn: "N/A",
            daysSinceLastSignIn: 0,
            grantStart: assignment.createdDateTime || "Unknown",
            grantExpiry: "Never",
            consentType: "Admin",
            scopes: permissionValue,
            riskyScopes: permissionValue
          });
        }
      } catch (e: any) {
        // Skip errors for individual service principals
        continue;
      }
    }

    // 4. Report & Remediate
    if (riskyGrants.length === 0) {
      IPC.success({ message: "✅ No risky Shadow IT detected. Tenant is clean!" });
      return;
    }

    // Sort by risk score (highest first)
    try {
      riskyGrants.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
      console.error(`[DEBUG] Sorted ${riskyGrants.length} grants`);
    } catch (e: any) {
      console.error(`[DEBUG] Sort failed: ${e.message}`);
    }

    const grantCount = riskyGrants?.length || 0;
    
    IPC.progress(`Found ${grantCount} risky grants. Calculating statistics...`, 90);

    // Calculate statistics
    let stats;
    try {
      IPC.progress(`Analyzing risk distribution...`, 91);
      stats = {
        total: riskyGrants.length,
        delegated: riskyGrants.filter(g => g?.grantType === "Delegated").length,
        application: riskyGrants.filter(g => g?.grantType === "Application").length,
        critical: riskyGrants.filter(g => g?.riskLevel === "Critical").length,
        high: riskyGrants.filter(g => g?.riskLevel === "High").length,
        medium: riskyGrants.filter(g => g?.riskLevel === "Medium").length,
        low: riskyGrants.filter(g => g?.riskLevel === "Low").length,
        unverified: riskyGrants.filter(g => g && !g.publisherVerified).length,
        thirdParty: riskyGrants.filter(g => g?.appOwnerType === "ThirdParty").length,
        expired: riskyGrants.filter(g => g?.credentialHealth?.includes("EXPIRED")).length,
        zombies: riskyGrants.filter(g => g?.daysSinceLastSignIn && g.daysSinceLastSignIn > 180).length
      };
      IPC.progress(`Stats calculated, preparing table...`, 92);
    } catch (e: any) {
      stats = { total: riskyGrants.length, delegated: 0, application: 0, critical: 0, high: 0, medium: 0, low: 0, unverified: 0, thirdParty: 0, expired: 0, zombies: 0 };
    }

    // Prepare Table Data for Rust (Top 50 for TUI, full data in logs)
    let tableRows: string[][] = [];
    try {
      const displayGrants = riskyGrants.slice(0, 50);
      console.error(`[DEBUG] Sliced display grants: ${displayGrants.length}`);
      
      tableRows = displayGrants.map((g, idx) => {
        try {
          if (idx < 5) console.error(`[DEBUG] Formatting row ${idx + 1}/${displayGrants.length}`);
          
          const riskEmoji = g.riskLevel === "Critical" ? "🔴" : 
                            g.riskLevel === "High" ? "🟠" : 
                            g.riskLevel === "Medium" ? "🟡" : "🟢";
          const verifiedBadge = g.publisherVerified ? "✓" : "⚠️";
          const publisherDisplay = g.publisher === "Unverified" ? `${verifiedBadge} ${g.publisher}` : g.publisher;
          
          // Format last sign-in
          let lastActiveDisplay = "N/A";
          if (g.grantType === "Delegated" && g.daysSinceLastSignIn !== null && g.daysSinceLastSignIn !== 0) {
            if (g.daysSinceLastSignIn > 365) {
              lastActiveDisplay = `${Math.floor(g.daysSinceLastSignIn / 365)}y ago`;
            } else if (g.daysSinceLastSignIn > 30) {
              lastActiveDisplay = `${Math.floor(g.daysSinceLastSignIn / 30)}mo ago`;
            } else {
              lastActiveDisplay = `${g.daysSinceLastSignIn}d ago`;
            }
          } else if (g.lastSignIn === "Never") {
            lastActiveDisplay = "Never";
          }
          
          // Severity badge
          const severityEmoji = 
            g.permissionSeverity === "CRITICAL" ? "🚨" :
            g.permissionSeverity === "HIGH" ? "⚠️" :
            g.permissionSeverity === "MEDIUM" ? "🔍" :
            g.permissionSeverity === "MIXED" ? "🔀" : "✓";
          
          return [
            `${riskEmoji} ${g.riskScore || 0}`,
            g.appName || "Unknown",
            publisherDisplay && publisherDisplay.length > 20 ? publisherDisplay.substring(0, 17) + "..." : (publisherDisplay || "Unknown"),
            `${severityEmoji} ${g.permissionSeverity || "LOW"}`,
            g.grantType || "Unknown",
            g.user && g.user.length > 25 ? g.user.substring(0, 22) + "..." : (g.user || "N/A"),
            lastActiveDisplay,
            g.consentType === "AllPrincipals" || g.consentType === "Admin" ? "🌐 Tenant" : "👤 User",
            g.riskyScopes && g.riskyScopes.length > 40 ? g.riskyScopes.substring(0, 37) + "..." : (g.riskyScopes || ""),
            g.recommendation && g.recommendation.length > 50 ? g.recommendation.substring(0, 47) + "..." : (g.recommendation || "Review required")
          ];
        } catch (rowError: any) {
          console.error(`[ERROR] Failed to format row ${idx}: ${rowError.message}`);
          return ["Error", "Error formatting row", "", "", "", "", "", "", "", ""];
        }
      });
      
      IPC.progress(`Table rows prepared (${tableRows.length} rows)`, 94);
    } catch (e: any) {
      tableRows = [["Error", "Failed to generate table", "", "", "", "", "", "", "", ""]];
    }

    IPC.progress(`Building summary...`, 95);
    
    const summaryMessage = `
=== Shadow IT Audit Summary ===
Scanned: ${stats.total} risky apps (${stats.delegated} Delegated, ${stats.application} Application)

Risk Distribution:
  🔴 Critical: ${stats.critical} apps   (Score 80-100)
  🟠 High:     ${stats.high} apps  (Score 60-79)
  🟡 Medium:   ${stats.medium} apps  (Score 40-59)
  🟢 Low:      ${stats.low} apps  (Score 0-39)

Top Concerns:
  • ${stats.unverified} apps from unverified publishers
  • ${stats.thirdParty} third-party apps
  • ${stats.expired} apps with expired credentials
  • ${stats.zombies} grants on users inactive >6 months
${riskyGrants.length > 50 ? `\n⚠️ Showing top 50 of ${riskyGrants.length} risky apps` : ""}
    `.trim();

    IPC.progress(`Preparing final payload...`, 98);
    
    const successPayload = {
        message: dryRun ? summaryMessage : "Remediation Complete",
        table: {
            headers: ["Risk", "App Name", "Publisher", "Permission Severity", "Type", "User/Scope", "Last Active", "Consent", "Risky Permissions", "Recommendation"],
            rows: tableRows
        }
    };
    
    IPC.progress(`Sending results...`, 99);

    if (dryRun) {
      try {
        IPC.success(successPayload);
        IPC.progress(`Report sent successfully`, 100);
      } catch (e: any) {
        IPC.error(`Failed to send results: ${e.message}`);
      }
    } else {
      IPC.progress("Remediating (Revoking Grants)...", 95);
      let revokedCount = 0;
      for (const item of riskyGrants) {
         try {
             if (item.grantType === "Delegated") {
               await client.api(`/oauth2PermissionGrants/${item.grantId}`).delete();
             } else {
               await client.api(`/servicePrincipals/${item.grantId}/appRoleAssignments/${item.grantId}`).delete();
             }
             revokedCount++;
             console.log(JSON.stringify({ type: 'progress', message: `Revoked ${item.appName} (${item.grantType})` }));
         } catch (e: any) {
             console.log(JSON.stringify({ type: 'error', message: `Failed to revoke ${item.appName}: ${e.message}` }));
         }
      }
      successPayload.message = `✅ Revoked ${revokedCount}/${riskyGrants.length} risky grants`;
      IPC.success(successPayload);
    }

  } catch (error: any) {
    IPC.error(error.message || "Unknown Error during Shadow IT Scan");
  }
}