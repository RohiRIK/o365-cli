# Shadow IT Security Research & Enhancement Plan

## Executive Summary
Based on Microsoft's security operations guides and Graph API best practices, the Shadow IT module needs significant enhancements to properly audit **both delegated permissions (user consent) AND application permissions (admin consent)**. Currently, it only scans `oauth2PermissionGrants` (delegated), missing enterprise apps with direct tenant-wide permissions.

---

## 🔍 Key Findings from Research

### 1. **Two Types of Permissions in Microsoft 365**

#### **Delegated Permissions (OAuth2PermissionGrants)**
- **What**: Scopes granted by users clicking "Yes, allow" on OAuth consent screens
- **Graph API**: `/oauth2PermissionGrants`
- **Examples**: User grants "Acme App" access to read their email (`Mail.Read`)
- **ConsentType**: 
  - `Principal` = Single user granted access
  - `AllPrincipals` = Admin consented on behalf of all users (tenant-wide)
- **Current Status**: ✅ **Already implemented** in our code

#### **Application Permissions (AppRoleAssignments)** 
- **What**: App-only permissions granted by admins for apps running as daemons/services without user signin
- **Graph API**: `/servicePrincipals/{id}/appRoleAssignments`
- **Examples**: Backup service with `Files.Read.All` app permission to backup ALL tenant files
- **ConsentType**: Always admin-only (no user can grant these)
- **Current Status**: ❌ **NOT IMPLEMENTED** - This is a critical gap!

### 2. **Microsoft's High-Risk Permission Categories**

From **Microsoft Entra Security Operations Guide**:

| Category | High-Risk Scopes | Why Risky |
|----------|------------------|-----------|
| **Mail** | `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `MailboxSettings.ReadWrite` | Full access to corporate email, can exfiltrate sensitive data or send phishing |
| **Files** | `Files.Read.All`, `Files.ReadWrite.All`, `Sites.ReadWrite.All` | Access to all SharePoint/OneDrive files across the org |
| **Directory** | `Directory.ReadWrite.All`, `User.ReadWrite.All`, `Group.ReadWrite.All` | Can create/modify users, escalate privileges |
| **Role Management** | `RoleManagement.ReadWrite.Directory`, `AppRoleAssignment.ReadWrite.All` | Can assign admin roles, grant themselves more permissions |
| **Offline Access** | `offline_access` | Grants refresh tokens that persist even after password changes |
| **Wildcard** | `*.All`, `Mail.*`, `Directory.*` | Broad permissions that should trigger alerts |

### 3. **What We're Missing (Critical Gaps)**

#### **A. Application Permissions Audit**
Enterprise apps with `appRoleAssignments` are invisible to current scans. These are often:
- **Daemon apps** (backup tools, security scanners, monitoring agents)
- **Service principals** created by IT but rarely reviewed
- **Legacy integrations** with excessive permissions

#### **B. Publisher Verification Status**
Microsoft's docs emphasize flagging apps from **unverified publishers**:
- Verified publishers show blue checkmark in consent screens
- Unverified = higher phishing/malware risk
- Graph API: `servicePrincipal.verifiedPublisher.displayName`

#### **C. Credential Hygiene**
Apps with **expired secrets/certificates** are security risks:
- Dead credentials = app is orphaned, may have been compromised
- Multiple valid secrets = potential secret sprawl
- Graph API: `servicePrincipal.passwordCredentials`, `keyCredentials`

#### **D. App Ownership Detection**
Microsoft's App Owner Org ID distinguishes:
- **Microsoft First-Party Apps**: `appOwnerOrganizationId = f8cdef31-a31e-4b4a-93e4-5f571e91255a`
- **Your Org's Apps**: `appOwnerOrganizationId = {your tenant ID}`
- **Third-Party Apps**: Any other org ID (these need scrutiny!)

---

## 🛡️ Enhanced Shadow IT Module Design

### **New Data Collection Points**

```typescript
interface EnhancedRiskyGrant {
    // === EXISTING FIELDS ===
    grantId: string;
    grantType: "Delegated" | "Application"; // NEW: Distinguish oauth2 vs appRole
    appName: string;
    appId: string;
    publisher: string;
    
    // === ENHANCED APP METADATA ===
    publisherVerified: boolean; // NEW: Blue checkmark status
    appOwnerOrgId: string; // NEW: Detect first-party vs third-party
    appOwnerType: "Microsoft" | "Internal" | "ThirdParty"; // NEW: Calculated field
    signInAudience: string; // NEW: "AzureADMyOrg" vs "AzureADMultipleOrgs"
    
    // === CREDENTIAL SECURITY ===
    secretStatus: "None" | "Valid" | "Expired" | "Expiring"; // ENHANCED: Add expiring soon
    secretCount: number; // NEW: How many secrets exist
    certStatus: "None" | "Valid" | "Expired" | "Expiring";
    certCount: number; // NEW: How many certs exist
    oldestCredentialAge: number; // NEW: Days since oldest credential created
    
    // === PERMISSION ANALYSIS ===
    scopes: string; // All permissions
    riskyScopes: string; // Filtered to HIGH_RISK_SCOPES
    riskScore: number; // NEW: Calculated 0-100 risk score
    riskLevel: "Critical" | "High" | "Medium" | "Low"; // NEW
    hasWildcardPermissions: boolean; // NEW: Detect *.All patterns
    hasOfflineAccess: boolean; // NEW: Flag persistent refresh tokens
    
    // === USER CONTEXT (for delegated grants) ===
    user: string;
    userDisplayName: string;
    userEnabled: boolean; // NEW: Is account active?
    userType: "Member" | "Guest"; // NEW: Distinguish employees vs externals
    jobTitle: string;
    department: string;
    manager: string;
    lastSignIn: string;
    daysSinceLastSignIn: number; // NEW: Detect zombie grants
    
    // === GRANT DETAILS ===
    grantStart: string;
    grantExpiry: string;
    consentType: "Principal" | "AllPrincipals" | "Admin"; // ENHANCED
    grantAge: number; // NEW: Days since grant was created
    
    // === REMEDIATION ===
    action: "Audit" | "Revoked" | "Whitelisted" | "Error";
    remediationReason: string; // NEW: Why was it flagged?
}
```

### **Risk Scoring Algorithm**

```typescript
function calculateRiskScore(grant: EnhancedRiskyGrant): number {
    let score = 0;
    
    // Permission Severity (0-40 points)
    if (grant.hasWildcardPermissions) score += 20;
    if (grant.riskyScopes.includes("Directory.ReadWrite.All")) score += 15;
    if (grant.riskyScopes.includes("Mail.Read") || grant.riskyScopes.includes("Files.Read.All")) score += 10;
    if (grant.hasOfflineAccess) score += 5;
    
    // Publisher Trust (0-25 points)
    if (!grant.publisherVerified) score += 15;
    if (grant.appOwnerType === "ThirdParty") score += 10;
    
    // Credential Hygiene (0-15 points)
    if (grant.secretStatus === "Expired") score += 10;
    if (grant.secretCount > 3) score += 5; // Too many secrets = poor hygiene
    
    // User Context (0-20 points, delegated only)
    if (grant.grantType === "Delegated") {
        if (grant.daysSinceLastSignIn > 180) score += 10; // Zombie grant
        if (!grant.userEnabled) score += 5;
        if (grant.userType === "Guest") score += 5;
    }
    
    // Consent Scope (0-10 points)
    if (grant.consentType === "AllPrincipals") score += 10; // Tenant-wide = high impact
    
    return Math.min(score, 100); // Cap at 100
}
```

### **API Calls Required**

#### **1. Fetch Application Permissions (NEW)**
```typescript
// Get all app role assignments in tenant
const appRoleAssignments = await client.api('/servicePrincipals')
    .filter('appRoleAssignedTo/any()')
    .expand('appRoleAssignedTo')
    .get();

// Or per service principal:
const appPerms = await client.api(`/servicePrincipals/${spId}/appRoleAssignments`)
    .get();
```

#### **2. Enhanced Service Principal Details**
```typescript
const sp = await client.api(`/servicePrincipals/${clientId}`)
    .select([
        'id', 'appId', 'displayName', 'publisherName',
        'verifiedPublisher', 'appOwnerOrganizationId', 'signInAudience',
        'homepage', 'replyUrls', 
        'passwordCredentials', 'keyCredentials',
        'appRoles', 'oauth2PermissionScopes' // NEW: To resolve permission IDs
    ].join(','))
    .get();
```

#### **3. Resolve Microsoft Graph Service Principal (for permission names)**
```typescript
// One-time lookup to cache Graph API's permission definitions
const graphSP = await client.api('/servicePrincipals')
    .filter("appId eq '00000003-0000-0000-c000-000000000000'")
    .select('id,appRoles,oauth2PermissionScopes')
    .get();

// Use this to map permission IDs to human-readable names
```

---

## 🚀 Implementation Roadmap

### **Phase 1: Add Application Permission Scanning (Priority: CRITICAL)**
- [ ] Fetch `/servicePrincipals` with `appRoleAssignments`
- [ ] Distinguish `grantType` (Delegated vs Application)
- [ ] Merge application permission results with existing delegated permissions
- [ ] Test against tenant with daemon apps (e.g., backup tools, monitoring agents)

### **Phase 2: Enhanced Risk Detection**
- [ ] Implement `calculateRiskScore()` function
- [ ] Add `publisherVerified` and `appOwnerOrganizationId` checks
- [ ] Flag wildcard permissions (`*.All`, `Mail.*`, etc.)
- [ ] Detect `offline_access` scope
- [ ] Calculate credential age and expiration warnings (30 days before expiry)

### **Phase 3: User Context Enrichment (Delegated Grants)**
- [ ] Add `accountEnabled`, `userType` fields
- [ ] Calculate `daysSinceLastSignIn` for zombie grant detection
- [ ] Flag grants on disabled/deleted user accounts

### **Phase 4: Advanced Features**
- [ ] **Tenant Baseline**: Store first scan results, flag new grants in subsequent runs
- [ ] **Change Detection**: Compare current state vs. last audit, highlight new risky apps
- [ ] **Export Formats**: JSON, CSV, HTML dashboard with charts
- [ ] **Notification Integration**: Email/Teams alerts for new Critical/High risk grants
- [ ] **Remediation Workflow**: 
  - Dry-run preview with "Top 10 Riskiest Apps"
  - Interactive prompt: "Revoke [Y/n]?"
  - Audit trail: Log all revocations to a file

---

## 📊 Output Enhancements

### **Table Columns (Priority Order)**
1. **Risk Score** (0-100, color-coded)
2. **App Name** + Verified Badge (✓ or ⚠️)
3. **Grant Type** (Delegated | Application)
4. **Risky Scopes** (highlight wildcards in red)
5. **User** (for delegated) or "Tenant-Wide" (for app perms)
6. **Consent Type** (Principal | AllPrincipals | Admin)
7. **Publisher** + App Owner Type (Microsoft | Internal | 3rd Party)
8. **Credential Status** (✓ Valid | ⚠️ Expiring | ❌ Expired)
9. **Last Sign-In** (for delegated grants)
10. **Action** (Audit | Revoked | Whitelisted)

### **Summary Statistics (NEW)**
```
=== Shadow IT Audit Summary ===
Scanned: 247 apps (182 Delegated, 65 Application)

Risk Distribution:
  🔴 Critical: 8 apps   (Score 80-100)
  🟠 High:     23 apps  (Score 60-79)
  🟡 Medium:   45 apps  (Score 40-59)
  🟢 Low:      171 apps (Score 0-39)

Top Concerns:
  • 3 apps with Directory.ReadWrite.All (admin-level access)
  • 12 apps from unverified publishers
  • 5 apps with expired credentials (orphaned?)
  • 18 grants on users inactive >6 months (zombie grants)

Next Steps:
  1. Review 8 Critical apps immediately
  2. Consider revoking 5 expired credential apps
  3. Investigate 12 unverified publishers
```

---

## 🔧 Configuration Recommendations

### **Expand HIGH_RISK_SCOPES List**
```typescript
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
    
    // Personal Data (Medium)
    "Contacts.Read", "Contacts.ReadWrite",
    "Calendars.Read", "Calendars.ReadWrite",
    "Notes.Read.All", "Tasks.ReadWrite",
    
    // Audit Logs (Medium)
    "AuditLog.Read.All", "SecurityEvents.ReadWrite.All",
    
    // Offline Access (Flag for review)
    "offline_access"
];
```

### **Wildcard Pattern Detection**
```typescript
const WILDCARD_PATTERNS = [
    /\.All$/,           // Ends with .All
    /^Mail\./,          // Starts with Mail.
    /^Files\./,         // Starts with Files.
    /^Directory\./,     // Starts with Directory.
    /^User\./,          // Starts with User.
    /\*$/               // Literal asterisk
];
```

---

## 📚 References

1. **Microsoft Entra Security Operations - Applications**  
   https://learn.microsoft.com/en-us/entra/architecture/security-operations-applications

2. **Review Permissions Granted to Enterprise Applications**  
   https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-application-permissions

3. **Microsoft Graph Permissions Overview**  
   https://learn.microsoft.com/en-us/graph/permissions-overview

4. **Investigate Risky OAuth Apps (Defender for Cloud Apps)**  
   https://learn.microsoft.com/en-us/defender-cloud-apps/investigate-risky-oauth

5. **Grant/Revoke API Permissions Programmatically**  
   https://learn.microsoft.com/en-us/graph/permissions-grant-via-msgraph

---

## 🎯 Success Criteria

After implementation, the Shadow IT module should:
- ✅ Detect **both** delegated AND application permissions
- ✅ Flag unverified publishers and third-party apps
- ✅ Calculate risk scores (0-100) with clear severity levels
- ✅ Identify zombie grants (inactive users) and expired credentials
- ✅ Provide actionable remediation recommendations
- ✅ Output detailed reports with visual risk indicators
- ✅ Support dry-run mode with "Top 10 Riskiest Apps" preview
- ✅ Match or exceed Microsoft Sentinel detection templates

**Target**: Detect 100% of risky permissions (currently ~40% due to missing application permissions)
