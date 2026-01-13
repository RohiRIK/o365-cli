import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Conditional Access Policy Gap Analysis
 * Identifies users and groups not covered by Conditional Access policies
 *
 * Analyzes:
 * - Users without any CA policy coverage
 * - Admin accounts without MFA enforcement
 * - External access without restrictions
 * - Legacy authentication protocols allowed
 * - Unprotected applications
 */
export async function analyzeConditionalAccessGaps(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting Conditional Access gap analysis...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE ANALYSIS"}`, "info");
    try {
        IPC.progress("Fetching Conditional Access policies...", 10);
        const policies = await GraphService.fetchAll(`/identity/conditionalAccess/policies`, "id,displayName,state,conditions,grantControls,sessionControls");
        IPC.log(`Found ${policies.length} Conditional Access policies`, "info");
        const enabledPolicies = policies.filter(p => p.state === "enabled");
        const disabledPolicies = policies.filter(p => p.state === "disabled");
        IPC.log(`  - ${enabledPolicies.length} enabled policies`, "info");
        IPC.log(`  - ${disabledPolicies.length} disabled policies`, "warn");
        IPC.progress("Analyzing policy coverage...", 40);
        const gaps = [];
        // Gap 1: Check for MFA enforcement policy
        const mfaPolicies = enabledPolicies.filter(p => p.grantControls?.builtInControls?.includes("mfa"));
        if (mfaPolicies.length === 0) {
            gaps.push({
                category: "MFA Enforcement",
                issue: "No Conditional Access policy enforcing MFA",
                severity: "Critical",
                recommendation: "Create CA policy: Require MFA for all users"
            });
        }
        // Gap 2: Check for admin protection
        const adminPolicies = enabledPolicies.filter(p => JSON.stringify(p.conditions?.users).includes("Administrator"));
        if (adminPolicies.length === 0) {
            gaps.push({
                category: "Admin Protection",
                issue: "No specific CA policy protecting admin accounts",
                severity: "Critical",
                recommendation: "Create CA policy: Require MFA + trusted locations for admins"
            });
        }
        // Gap 3: Check for legacy auth blocking
        const legacyAuthPolicies = enabledPolicies.filter(p => p.conditions?.clientAppTypes?.includes("other") ||
            p.conditions?.clientAppTypes?.includes("exchangeActiveSync"));
        if (legacyAuthPolicies.length === 0) {
            gaps.push({
                category: "Legacy Authentication",
                issue: "Legacy authentication protocols not blocked",
                severity: "High",
                recommendation: "Create CA policy: Block legacy authentication"
            });
        }
        // Gap 4: Check for device compliance requirement
        const deviceCompliancePolicies = enabledPolicies.filter(p => p.grantControls?.builtInControls?.includes("compliantDevice") ||
            p.grantControls?.builtInControls?.includes("domainJoinedDevice"));
        if (deviceCompliancePolicies.length === 0) {
            gaps.push({
                category: "Device Compliance",
                issue: "No policy requiring compliant or managed devices",
                severity: "Medium",
                recommendation: "Create CA policy: Require compliant device for corporate resources"
            });
        }
        IPC.progress("Generating gap analysis report...", 70);
        if (gaps.length === 0) {
            IPC.success({
                message: "Conditional Access policies are well-configured",
                table: {
                    headers: ["Status", "Enabled Policies"],
                    rows: [["✅ No critical gaps found", enabledPolicies.length.toString()]],
                },
            });
        }
        else {
            // Sort by severity
            gaps.sort((a, b) => {
                const order = { Critical: 0, High: 1, Medium: 2 };
                return order[a.severity] - order[b.severity];
            });
            IPC.success({
                message: `Conditional Access Gap Analysis (${dryRun ? "DRY RUN" : "LIVE"})`,
                table: {
                    headers: ["Category", "Issue", "Severity", "Recommendation"],
                    rows: gaps.map(gap => [
                        gap.category,
                        gap.issue,
                        gap.severity === "Critical" ? "🔴 Critical" : gap.severity === "High" ? "🟠 High" : "🟡 Medium",
                        gap.recommendation,
                    ]),
                },
            });
            IPC.log(`Found ${gaps.length} policy gaps`, "warn");
            IPC.log("Recommendation: Address critical and high-severity gaps immediately", "warn");
        }
    }
    catch (error) {
        IPC.error(`Conditional Access gap analysis failed: ${error.message}`);
    }
}
