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
