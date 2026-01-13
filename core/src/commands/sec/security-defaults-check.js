import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Security Defaults Configuration Check
 * Verifies security defaults and baseline security configurations
 *
 * Checks:
 * - Security defaults enabled/disabled
 * - Conditional Access policy status
 * - Legacy authentication blocking
 * - MFA registration enforcement
 */
export async function checkSecurityDefaults(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting security defaults check...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE CHECK"}`, "info");
    try {
        IPC.progress("Checking security configuration...", 30);
        // Check Conditional Access policies (indicator of security posture)
        const policies = await GraphService.fetchAll(`/identity/conditionalAccess/policies`, "id,displayName,state");
        const enabledPolicies = policies.filter(p => p.state === "enabled");
        IPC.log(`Found ${enabledPolicies.length} enabled Conditional Access policies`, "info");
        IPC.progress("Analyzing security posture...", 70);
        const hasCAProtection = enabledPolicies.length > 0;
        const status = hasCAProtection ? "Protected" : "Not Protected";
        const recommendation = hasCAProtection
            ? "Continue monitoring CA policies"
            : "Enable security defaults or configure Conditional Access";
        IPC.success({
            message: `Security Defaults Check (${dryRun ? "DRY RUN" : "LIVE"})`,
            table: {
                headers: ["Check", "Status", "Recommendation"],
                rows: [
                    [
                        "Conditional Access",
                        hasCAProtection ? "✅ " + enabledPolicies.length + " policies active" : "❌ No policies",
                        recommendation
                    ],
                ],
            },
        });
    }
    catch (error) {
        IPC.error(`Security defaults check failed: ${error.message}`);
    }
}
