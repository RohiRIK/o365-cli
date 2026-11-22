import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
import * as fs from "fs";
import * as path from "path";
/**
 * MFA Enforcement Audit
 * Identify users without MFA, legacy auth usage, and conditional access gaps
 *
 * Detects:
 * - Users without MFA registered
 * - Privileged users without MFA
 * - Legacy authentication usage
 * - Conditional access policy gaps
 * - MFA method types (SMS, app, FIDO2, etc.)
 */
export async function auditMFAEnforcement(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting MFA enforcement audit...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");
    try {
        // Phase 1: Fetch All Users (0-20%)
        IPC.progress("Fetching user list...", 5);
        const users = await GraphService.fetchAll(`/users`, "id,userPrincipalName,displayName,accountEnabled,assignedLicenses", {
            filter: "accountEnabled eq true",
        });
        IPC.log(`Found ${users.length} active users`, "info");
        // Phase 2: Fetch User Authentication Methods (20-50%)
        IPC.progress("Analyzing MFA registration status...", 20);
        const userMFAStatus = [];
        let processedCount = 0;
        const totalUsers = users.length;
        for (const user of users) {
            try {
                // Fetch authentication methods for this user
                const authMethods = await GraphService.fetchAll(`/users/${user.id}/authentication/methods`, "id,@odata.type", {});
                // Determine MFA methods
                const mfaMethods = [];
                authMethods.forEach((method) => {
                    const methodType = method["@odata.type"];
                    if (methodType?.includes("microsoftAuthenticator")) {
                        mfaMethods.push("Authenticator App");
                    }
                    else if (methodType?.includes("phone")) {
                        mfaMethods.push("Phone (SMS/Call)");
                    }
                    else if (methodType?.includes("fido2")) {
                        mfaMethods.push("FIDO2 Security Key");
                    }
                    else if (methodType?.includes("windowsHelloForBusiness")) {
                        mfaMethods.push("Windows Hello");
                    }
                    else if (methodType?.includes("softwareOath")) {
                        mfaMethods.push("Software Token");
                    }
                });
                const hasMFA = mfaMethods.length > 0;
                // Check if user is admin (has licenses or high-privilege role)
                // In production, would check directory roles via separate API call
                const isAdmin = user.userPrincipalName.toLowerCase().includes("admin");
                // Determine risk level
                let riskLevel;
                let recommendation;
                if (isAdmin && !hasMFA) {
                    riskLevel = "critical";
                    recommendation = "URGENT: Privileged user without MFA. Enable MFA immediately.";
                }
                else if (!hasMFA) {
                    riskLevel = "high";
                    recommendation = "Enable MFA to protect account. Enforce via Conditional Access.";
                }
                else if (mfaMethods.includes("Phone (SMS/Call)") && mfaMethods.length === 1) {
                    riskLevel = "medium";
                    recommendation = "SMS-only MFA is vulnerable to SIM swapping. Add Authenticator App.";
                }
                else {
                    riskLevel = "low";
                    recommendation = "MFA configured. Consider adding backup method.";
                }
                userMFAStatus.push({
                    userPrincipalName: user.userPrincipalName,
                    displayName: user.displayName,
                    hasMFA,
                    mfaMethods,
                    hasLegacyAuth: false, // Would require sign-in logs analysis
                    isAdmin,
                    riskLevel,
                    recommendation,
                });
                processedCount++;
                if (processedCount % 50 === 0) {
                    const progress = 20 + Math.floor((processedCount / totalUsers) * 30);
                    IPC.progress(`Processed ${processedCount}/${totalUsers} users...`, progress);
                }
            }
            catch (error) {
                // User might not have auth methods endpoint access
                IPC.log(`Failed to fetch auth methods for ${user.userPrincipalName}: ${error.message}`, "warn");
                // Default to no MFA
                userMFAStatus.push({
                    userPrincipalName: user.userPrincipalName,
                    displayName: user.displayName,
                    hasMFA: false,
                    mfaMethods: [],
                    hasLegacyAuth: false,
                    isAdmin: user.userPrincipalName.toLowerCase().includes("admin"),
                    riskLevel: "high",
                    recommendation: "Unable to verify MFA status. Check manually.",
                });
            }
        }
        // Phase 3: Fetch Conditional Access Policies (50-70%)
        IPC.progress("Analyzing Conditional Access policies...", 50);
        let conditionalAccessPolicies = [];
        try {
            const policies = await GraphService.fetchAll(`/identity/conditionalAccess/policies`, "id,displayName,state,grantControls,conditions", {});
            IPC.log(`Found ${policies.length} Conditional Access policies`, "info");
            conditionalAccessPolicies = policies.map((p) => {
                const requiresMFA = p.grantControls?.builtInControls?.includes("mfa") ||
                    p.grantControls?.builtInControls?.includes("multiFactorAuthentication");
                const coverageGap = p.state !== "enabled" && requiresMFA;
                return {
                    id: p.id,
                    displayName: p.displayName,
                    state: p.state,
                    grantControls: p.grantControls,
                    requiresMFA,
                    coverageGap,
                };
            });
        }
        catch (error) {
            IPC.log(`Conditional Access policies access denied: ${error.message}`, "warn");
            IPC.log("Requires Policy.Read.All permission", "warn");
        }
        // Phase 4: Analyze Legacy Authentication (70-85%)
        IPC.progress("Checking for legacy authentication usage...", 70);
        try {
            // Fetch recent sign-ins to detect legacy auth
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const signIns = await GraphService.fetchAll(`/auditLogs/signIns`, "id,createdDateTime,userPrincipalName,clientAppUsed,authenticationRequirement", {
                filter: `createdDateTime ge ${sevenDaysAgo.toISOString()}`,
            });
            // Mark users with legacy auth
            const legacyAuthApps = ["exchangeActiveSync", "pop", "imap", "smtp", "other", "mobileAppsAndDesktopClients"];
            signIns.forEach((signIn) => {
                const clientApp = (signIn.clientAppUsed || "").toLowerCase();
                const isLegacyAuth = legacyAuthApps.some(app => clientApp.includes(app));
                if (isLegacyAuth) {
                    const userStatus = userMFAStatus.find(u => u.userPrincipalName === signIn.userPrincipalName);
                    if (userStatus) {
                        userStatus.hasLegacyAuth = true;
                        if (userStatus.riskLevel === "low") {
                            userStatus.riskLevel = "medium";
                        }
                        userStatus.recommendation += " Block legacy authentication protocols.";
                    }
                }
            });
            IPC.log(`Analyzed ${signIns.length} sign-ins for legacy auth detection`, "info");
        }
        catch (error) {
            IPC.log(`Sign-in logs access denied: ${error.message}`, "warn");
            IPC.log("Requires AuditLog.Read.All permission", "warn");
        }
        // Phase 5: Generate Statistics (85-95%)
        IPC.progress("Generating audit statistics...", 85);
        const stats = {
            totalUsers: userMFAStatus.length,
            usersWithMFA: userMFAStatus.filter(u => u.hasMFA).length,
            usersWithoutMFA: userMFAStatus.filter(u => !u.hasMFA).length,
            adminWithoutMFA: userMFAStatus.filter(u => u.isAdmin && !u.hasMFA).length,
            legacyAuthUsers: userMFAStatus.filter(u => u.hasLegacyAuth).length,
            criticalRisk: userMFAStatus.filter(u => u.riskLevel === "critical").length,
            highRisk: userMFAStatus.filter(u => u.riskLevel === "high").length,
            mediumRisk: userMFAStatus.filter(u => u.riskLevel === "medium").length,
            lowRisk: userMFAStatus.filter(u => u.riskLevel === "low").length,
            totalPolicies: conditionalAccessPolicies.length,
            policiesRequiringMFA: conditionalAccessPolicies.filter(p => p.requiresMFA).length,
            disabledPolicies: conditionalAccessPolicies.filter(p => p.state !== "enabled").length,
        };
        IPC.progress("Generating report...", 95);
        // Phase 6: Export Report (95-100%)
        if (!dryRun && userMFAStatus.length > 0) {
            const exportDir = path.join(process.cwd(), "exports", "mfa-audit");
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `mfa_audit_${timestamp}.json`;
            const filePath = path.join(exportDir, fileName);
            // Create directory if it doesn't exist
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            // Separate users by risk level
            const criticalUsers = userMFAStatus.filter(u => u.riskLevel === "critical");
            const highRiskUsers = userMFAStatus.filter(u => u.riskLevel === "high");
            const mediumRiskUsers = userMFAStatus.filter(u => u.riskLevel === "medium");
            // Write export file
            fs.writeFileSync(filePath, JSON.stringify({
                auditMetadata: {
                    auditDate: new Date().toISOString(),
                    scope: "Organization-wide MFA enforcement",
                    totalUsers: stats.totalUsers,
                    mfaCoverage: `${((stats.usersWithMFA / stats.totalUsers) * 100).toFixed(1)}%`,
                },
                statistics: stats,
                criticalRiskUsers: criticalUsers,
                highRiskUsers: highRiskUsers,
                mediumRiskUsers: mediumRiskUsers,
                conditionalAccessPolicies: conditionalAccessPolicies,
            }, null, 2));
            IPC.log(`Audit report saved: ${filePath}`, "info");
            const mfaCoverage = ((stats.usersWithMFA / stats.totalUsers) * 100).toFixed(1);
            IPC.success({
                message: `MFA enforcement audit completed`,
                file_path: filePath,
                table: {
                    headers: ["Category", "Count", "Status"],
                    rows: [
                        ["Total Users", stats.totalUsers.toString(), "ℹ️"],
                        ["MFA Coverage", `${mfaCoverage}%`, parseFloat(mfaCoverage) > 90 ? "✅" : "⚠️"],
                        ["Users without MFA", stats.usersWithoutMFA.toString(), stats.usersWithoutMFA > 0 ? "⚠️ Review" : "✅"],
                        [
                            "Admins without MFA",
                            stats.adminWithoutMFA.toString(),
                            stats.adminWithoutMFA > 0 ? "🚨 CRITICAL" : "✅",
                        ],
                        ["Legacy Auth Users", stats.legacyAuthUsers.toString(), stats.legacyAuthUsers > 0 ? "⚠️ Block" : "✅"],
                        ["Critical Risk", stats.criticalRisk.toString(), stats.criticalRisk > 0 ? "🚨 URGENT" : "✅"],
                        ["High Risk", stats.highRisk.toString(), stats.highRisk > 0 ? "⚠️ Review" : "✅"],
                        ["CA Policies", stats.totalPolicies.toString(), "ℹ️"],
                        ["Disabled Policies", stats.disabledPolicies.toString(), stats.disabledPolicies > 0 ? "⚠️ Review" : "✅"],
                    ],
                },
            });
            // Show critical and high-risk users
            if (criticalUsers.length > 0) {
                IPC.log("\n🚨 CRITICAL: Privileged Users Without MFA:", "error");
                criticalUsers.slice(0, 10).forEach((u, i) => {
                    IPC.log(`${i + 1}. ${u.userPrincipalName} (${u.displayName})`, "error");
                });
                if (criticalUsers.length > 10) {
                    IPC.log(`... and ${criticalUsers.length - 10} more critical users`, "error");
                }
            }
            if (highRiskUsers.length > 0) {
                IPC.log("\n⚠️  HIGH RISK: Users Without MFA (Top 10):", "warn");
                highRiskUsers.slice(0, 10).forEach((u, i) => {
                    IPC.log(`${i + 1}. ${u.userPrincipalName} (${u.displayName})`, "warn");
                });
                if (highRiskUsers.length > 10) {
                    IPC.log(`... and ${highRiskUsers.length - 10} more high-risk users`, "warn");
                }
            }
            // Recommendations
            IPC.log("\n📋 Remediation Recommendations:", "info");
            if (stats.adminWithoutMFA > 0) {
                IPC.log("1. URGENT: Enable MFA for all privileged users immediately", "info");
            }
            if (stats.policiesRequiringMFA === 0) {
                IPC.log("2. Create Conditional Access policy requiring MFA for all users", "info");
            }
            if (stats.legacyAuthUsers > 0) {
                IPC.log("3. Block legacy authentication protocols via Conditional Access", "info");
            }
            if (stats.usersWithoutMFA > 0) {
                IPC.log("4. Enforce MFA registration for all users within 30 days", "info");
            }
        }
        else if (userMFAStatus.length === 0) {
            IPC.success({
                message: `No users found or access denied`,
                table: {
                    headers: ["Status", "Details"],
                    rows: [["Users", "None or access denied"]],
                },
            });
        }
        else {
            // Dry run - show preview
            const preview = userMFAStatus.filter(u => !u.hasMFA).slice(0, 10);
            IPC.success({
                message: `MFA enforcement audit preview (DRY RUN - no file created)`,
                table: {
                    headers: ["User", "MFA Status", "Risk Level", "Recommendation"],
                    rows: preview.map(u => [
                        u.userPrincipalName,
                        u.hasMFA ? `✅ ${u.mfaMethods.join(", ")}` : "❌ None",
                        u.riskLevel.toUpperCase(),
                        u.recommendation.substring(0, 50) + (u.recommendation.length > 50 ? "..." : ""),
                    ]),
                },
            });
            const mfaCoverage = ((stats.usersWithMFA / stats.totalUsers) * 100).toFixed(1);
            IPC.log(`\nAudit Summary:`, "info");
            IPC.log(`- Total Users: ${stats.totalUsers}`, "info");
            IPC.log(`- MFA Coverage: ${mfaCoverage}%`, "info");
            IPC.log(`- Without MFA: ${stats.usersWithoutMFA}`, "info");
            IPC.log(`- Admins without MFA: ${stats.adminWithoutMFA}`, "info");
            IPC.log(`- Legacy Auth: ${stats.legacyAuthUsers}`, "info");
            IPC.log(`- Critical Risk: ${stats.criticalRisk}`, "info");
            IPC.log(`- High Risk: ${stats.highRisk}`, "info");
            IPC.log(`\nTo generate full audit report, use --dry-run false`, "info");
        }
    }
    catch (error) {
        IPC.error(`MFA enforcement audit failed: ${error.message}`);
    }
}
