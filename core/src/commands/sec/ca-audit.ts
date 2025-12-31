import { fetchCAPolicies } from "../../handlers/sec/ca-audit";
import { formatTable } from "../../utils/output";
import { GraphService } from "../../services/graph";
import chalk from "chalk";

/**
 * Cache for ID-to-Name resolution
 */
const nameCache = new Map<string, string>([
  ["All", "All Users"],
  ["None", "None"],
  ["AllPrincipals", "All Users (Tenant-Wide)"],
  ["Office365", "Office 365"],
  ["MicrosoftAdminPortals", "Microsoft Admin Portals"],
  ["00000003-0000-0000-c000-000000000000", "Microsoft Graph"],
  ["00000003-0000-0ff1-ce00-000000000000", "Office 365 SharePoint Online"],
  ["00000002-0000-0000-c000-000000000000", "Microsoft Azure AD"],
  ["4498dc2d-29eb-4f58-bd02-075b9a8626f8", "Microsoft Azure Management"],
  ["797f4846-ba00-4fd7-ba43-dac1f8f63013", "Microsoft Azure Service Management"]
]);

/**
 * Resolves a list of IDs to their human-readable names/UPNs
 * @param limit Optional limit for display (useful for CLI tables)
 */
async function resolveIds(ids: string[], limit: number = 999): Promise<string> {
  if (!ids || ids.length === 0) return "None";
  
  const displayIds = ids.slice(0, limit);
  const resolved = await Promise.all(displayIds.map(async id => {
    if (nameCache.has(id)) return nameCache.get(id)!;
    
    // Attempt resolution via Graph
    try {
      if (id.length > 20) { // Likely a GUID or Template ID
        // Try user
        try {
          const u = await GraphService.get(`/users/${id}?$select=userPrincipalName`);
          if (u?.userPrincipalName) {
            nameCache.set(id, u.userPrincipalName);
            return u.userPrincipalName;
          }
        } catch {} // Ignore errors, fall through to next attempt

        // Try group
        try {
          const g = await GraphService.get(`/groups/${id}?$select=displayName`);
          if (g?.displayName) {
            nameCache.set(id, g.displayName);
            return g.displayName;
          }
        } catch {} // Ignore errors

        // Try directory role
        try {
          const r = await GraphService.get(`/directoryRoles/${id}?$select=displayName`);
          if (r?.displayName) {
            nameCache.set(id, r.displayName);
            return r.displayName;
          }
        } catch {} // Ignore errors
      }
      return id; // Return original ID if resolution fails
    } catch (e) {
      console.error(`Error resolving ID ${id}:`, e);
      return id; // Return original ID on unexpected error
    }
  }));

  let result = resolved.join("; ");
  if (ids.length > limit) {
    result += ` (+${ids.length - limit} more)`;
  }
  return result;
}

/**
 * Summarizes session controls into a readable string
 */
function summarizeSessionControls(session: any): string {
  if (!session) return "None";
  const parts: string[] = [];

  if (session.signInFrequency) {
    const freq = session.signInFrequency;
    parts.push(`Freq: ${freq.value} ${freq.type}`);
  }
  
  if (session.persistentBrowser?.mode === "always") {
    parts.push("Persistent Browser");
  }
  
  if (session.applicationEnforcedRestrictions) {
    parts.push("App Enforced Restrictions");
  }
  
  const casType = session.cloudAppSecurity?.cloudAppSecurityType;
  if (casType && casType !== "none") {
    parts.push(`MCAS: ${casType}`);
  }
  
  if (session.signInContextClassReferences?.length) {
    parts.push(`Auth Context: ${session.signInContextClassReferences.join(", ")}`);
  }

  return parts.join("; ") || "None";
}

/**
 * Main audit logic for CA policies
 */
export async function auditCAPolicies(args: { analyze: boolean; state?: string; target?: string }) {
  const policies = await fetchCAPolicies();
  
  let filtered = policies;
  
  // Filter by state
  if (args.state) {
    filtered = filtered.filter((p: any) => p.state === args.state);
  }
  
  // Filter by target (simplified for now: check if UPN/ID is in included users)
  if (args.target) {
    filtered = filtered.filter((p: any) => {
      const users = p.conditions?.users;
      return users?.includeUsers?.includes(args.target) || 
             users?.includeUsers?.includes("All") ||
             users?.includeGroups?.includes(args.target) ||
             users?.includeRoles?.includes(args.target);
    });
  }
  
  return filtered;
}

/**
 * Renders the policy list as a table
 */
export async function renderCAPoliciesTable(policies: any[]): Promise<string> {
  const headers = ["Policy Name", "State", "Assignments", "Conditions", "Grant Controls"];
  
  const rows = await Promise.all(policies.map(async p => {
    const stateColor = p.state === "enabled" ? chalk.green : (p.state === "disabled" ? chalk.red : chalk.yellow);
    
    return [
      p.displayName || "Untitled",
      stateColor(p.state),
      await summarizeAssignments(p.conditions?.users, 2), // Show 2 names in CLI
      await summarizeConditions(p.conditions, 2),
      summarizeGrantControls(p.grantControls)
    ];
  }));
  
  return formatTable(headers, rows);
}

/**
 * Flattens a policy object into a granular record for CSV export
 */
export async function flattenPolicyForExport(p: any): Promise<Record<string, string>> {
  const users = p.conditions?.users || {};
  const cond = p.conditions || {};
  const grants = p.grantControls || {};

  return {
    "Policy Name": p.displayName || "Untitled",
    "State": p.state || "unknown",
    "ID": p.id || "",
    "Included Users": await resolveIds(users.includeUsers),
    "Excluded Users": await resolveIds(users.excludeUsers),
    "Included Groups": await resolveIds(users.includeGroups),
    "Excluded Groups": await resolveIds(users.excludeGroups),
    "Included Roles": await resolveIds(users.includeRoles),
    "Excluded Roles": await resolveIds(users.excludeRoles),
    "Included Apps": await resolveIds(cond.applications?.includeApplications),
    "Excluded Apps": await resolveIds(cond.applications?.excludeApplications),
    "Platforms (Inc)": (cond.platforms?.includePlatforms || []).join("; "),
    "Platforms (Exc)": (cond.platforms?.excludePlatforms || []).join("; "),
    "Client Apps": (cond.clientAppTypes || []).join("; "),
    "Locations (Inc)": (cond.locations?.includeLocations || []).join("; "),
    "Locations (Exc)": (cond.locations?.excludeLocations || []).join("; "),
    "Grant Controls": (grants.builtInControls || []).join("; "),
    "Grant Operator": grants.operator || "OR",
    "Session Controls": summarizeSessionControls(p.sessionControls)
  };
}

/**
 * Normalizes user assignments for display
 */
export async function summarizeAssignments(users: any, limit: number = 999): Promise<string> {
  if (!users) return "None";
  
  const parts: string[] = [];
  
  if (users.includeUsers?.length) {
    if (users.includeUsers.includes("All")) {
        parts.push("Users: [All]");
    } else {
        const names = await resolveIds(users.includeUsers, limit);
        parts.push(`Users: ${names}`);
    }
  }
  
  if (users.includeGroups?.length) {
    const names = await resolveIds(users.includeGroups, limit);
    parts.push(`Groups: ${names}`);
  }
  
  if (users.includeRoles?.length) {
    const names = await resolveIds(users.includeRoles, limit);
    parts.push(`Roles: ${names}`);
  }
  
  const excludeCount = (users.excludeUsers?.length || 0) + 
                       (users.excludeGroups?.length || 0) + 
                       (users.excludeRoles?.length || 0);
  
  if (excludeCount > 0) {
    parts.push(`Exclude: ${excludeCount}`);
  }
  
  return parts.join(", ") || "None";
}

/**
 * Normalizes policy conditions for display
 */
export async function summarizeConditions(conditions: any, limit: number = 999): Promise<string> {
  if (!conditions) return "None";
  
  const parts: string[] = [];
  
  // Platforms
  if (conditions.platforms) {
    const p = conditions.platforms;
    const included = p.includePlatforms?.join(", ");
    const excluded = p.excludePlatforms?.length ? ` (Exc: ${p.excludePlatforms.join(", ")})` : "";
    if (included) {
      const platformStr = included.charAt(0).toUpperCase() + included.slice(1);
      parts.push(`Platforms: ${platformStr}${excluded}`);
    }
  }
  
  // Target Apps
  if (conditions.applications?.includeApplications?.length) {
      const names = await resolveIds(conditions.applications.includeApplications, limit);
      parts.push(`Apps: ${names}`);
  }

  // Client Apps
  if (conditions.clientAppTypes?.length) {
    const apps = conditions.clientAppTypes.map((a: string) => {
      if (a === "mobileAppsAndDesktopClients") return "mobile";
      return a;
    }).join(", ");
    parts.push(`Clients: ${apps}`);
  }
  
  // Locations
  if (conditions.locations) {
    const l = conditions.locations;
    if (l.includeLocations?.length) parts.push(`Loc: ${l.includeLocations.length}`);
  }
  
  return parts.join("\n") || "Standard";
}

/**
 * Normalizes grant controls for display
 */
export function summarizeGrantControls(grantControls: any): string {
  if (!grantControls) return "None";
  
  const controls = grantControls.builtInControls || [];
  const operator = grantControls.operator || "AND";
  
  return controls.join(` ${operator} `) || "Block";
}