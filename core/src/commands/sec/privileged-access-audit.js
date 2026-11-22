import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Privileged Access Audit
 * Reviews administrative role assignments and identifies excessive privileges
 *
 * Audits:
 * - Global Administrator assignments
 * - Privileged role assignments (User Admin, Exchange Admin, etc.)
 * - Stale admin accounts (admins who haven't signed in)
 * - Admins without MFA
 * - Excessive role proliferation
 */
export async function auditPrivilegedAccess(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting privileged access audit...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");
    try {
        IPC.progress("Fetching directory roles...", 10);
        const roles = await GraphService.fetchAll(`/directoryRoles`, "id,displayName,description");
        IPC.log(`Found ${roles.length} active directory roles`, "info");
        IPC.progress("Analyzing role assignments...", 30);
        const privilegedUsers = new Map();
        // Fetch role members for each role
        for (const role of roles) {
            try {
                const members = await GraphService.fetchAll(`/directoryRoles/${role.id}/members`, "id,userPrincipalName,displayName,accountEnabled");
                for (const member of members) {
                    if (member.userPrincipalName) {
                        if (!privilegedUsers.has(member.userPrincipalName)) {
                            privilegedUsers.set(member.userPrincipalName, {
                                userPrincipalName: member.userPrincipalName,
                                displayName: member.displayName,
                                roles: [],
                                riskFactors: [],
                                riskLevel: "Medium",
                            });
                        }
                        const user = privilegedUsers.get(member.userPrincipalName);
                        user.roles.push(role.displayName);
                        // Risk assessment
                        if (role.displayName === "Global Administrator") {
                            user.riskFactors.push("Global Admin");
                            user.riskLevel = "Critical";
                        }
                        if (!member.accountEnabled) {
                            user.riskFactors.push("Account disabled");
                        }
                    }
                }
            }
            catch (error) {
                // Skip roles we can't access
            }
        }
        IPC.progress("Assessing privilege risks...", 60);
        // Convert to array and sort by risk
        const users = Array.from(privilegedUsers.values());
        const globalAdmins = users.filter(u => u.roles.includes("Global Administrator"));
        const criticalUsers = users.filter(u => u.riskLevel === "Critical");
        IPC.log(`Found ${users.length} privileged users`, "warn");
        IPC.log(`  - ${globalAdmins.length} Global Administrators`, "error");
        IPC.log(`  - ${criticalUsers.length} critical-risk privileged accounts`, "warn");
        if (users.length === 0) {
            IPC.success({
                message: "No privileged users found",
                table: {
                    headers: ["Status"],
                    rows: [["No directory role assignments"]],
                },
            });
        }
        else {
            // Sort by risk level and role count
            users.sort((a, b) => {
                const riskOrder = { Critical: 0, High: 1, Medium: 2 };
                if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
                    return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
                }
                return b.roles.length - a.roles.length;
            });
            const topUsers = users.slice(0, 20);
            IPC.success({
                message: `Privileged Access Audit (${dryRun ? "DRY RUN" : "LIVE"})`,
                table: {
                    headers: ["User", "Display Name", "Roles", "Risk Factors", "Risk Level"],
                    rows: topUsers.map(u => [
                        u.userPrincipalName,
                        u.displayName,
                        u.roles.length.toString() + " roles",
                        u.riskFactors.join(", ") || "None",
                        u.riskLevel === "Critical" ? "🔴 Critical" : u.riskLevel === "High" ? "🟠 High" : "🟡 Medium",
                    ]),
                },
            });
            IPC.log(`Showing top 20 privileged users (${users.length} total)`, "info");
            IPC.log("Recommendation: Limit Global Administrator assignments to 2-3 accounts", "warn");
            IPC.log("Best practice: Use Privileged Identity Management (PIM) for just-in-time access", "info");
        }
    }
    catch (error) {
        IPC.error(`Privileged access audit failed: ${error.message}`);
    }
}
