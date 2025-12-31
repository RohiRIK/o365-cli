import { fetchCAPolicies } from "../../handlers/sec/ca-audit";
import { formatTable } from "../../utils/output";
import chalk from "chalk";

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
export function renderCAPoliciesTable(policies: any[]): string {
  const headers = ["Policy Name", "State", "Assignments", "Conditions", "Grant Controls"];
  
  const rows = policies.map(p => {
    const stateColor = p.state === "enabled" ? chalk.green : (p.state === "disabled" ? chalk.red : chalk.yellow);
    
    return [
      p.displayName || "Untitled",
      stateColor(p.state),
      summarizeAssignments(p.conditions?.users),
      summarizeConditions(p.conditions),
      summarizeGrantControls(p.grantControls)
    ];
  });
  
  return formatTable(headers, rows);
}

/**
 * Normalizes user assignments for display
 */
export function summarizeAssignments(users: any): string {
  if (!users) return "None";
  
  const parts: string[] = [];
  
  if (users.includeUsers?.length) {
    const included = users.includeUsers.includes("All") ? "[All]" : users.includeUsers.length;
    parts.push(`Users: ${included}`);
  }
  
  if (users.includeGroups?.length) {
    parts.push(`Groups: ${users.includeGroups.length}`);
  }
  
  if (users.includeRoles?.length) {
    parts.push(`Roles: ${users.includeRoles.length}`);
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
export function summarizeConditions(conditions: any): string {
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
  
  // Client Apps
  if (conditions.clientAppTypes?.length) {
    const apps = conditions.clientAppTypes.map((a: string) => {
      if (a === "mobileAppsAndDesktopClients") return "mobile";
      return a;
    }).join(", ");
    parts.push(`Apps: ${apps}`);
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
