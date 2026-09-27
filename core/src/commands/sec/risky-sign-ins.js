import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Risky Sign-In Detection
 * Identifies high-risk authentication events using Entra ID Identity Protection
 *
 * Risk types:
 * - Anonymous IP addresses (Tor, VPN, proxies)
 * - Atypical travel (impossible travel scenarios)
 * - Malware-linked IP addresses
 * - Leaked credentials
 * - Password spray attacks
 */
export async function detectRiskySignIns(days = 7, dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting risky sign-in detection...", 0);
    IPC.log(`Analyzing sign-ins from last ${days} days`, "info");
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE DETECTION"}`, "info");
    try {
        IPC.progress("Fetching sign-in logs...", 10);
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const startIso = startDate.toISOString();
        // Fetch risky sign-ins
        const riskySignIns = await GraphService.fetchAll(`/auditLogs/signIns`, "id,createdDateTime,userPrincipalName,appDisplayName,ipAddress,location,status,riskLevel,riskDetail,riskState", {
            filter: `createdDateTime ge ${startIso} and riskLevel ne 'none'`,
        });
        IPC.log(`Found ${riskySignIns.length} risky sign-in events`, riskySignIns.length > 0 ? "warn" : "info");
        IPC.progress("Analyzing risk patterns...", 50);
        // Categorize by risk level
        const highRisk = riskySignIns.filter(s => s.riskLevel === "high");
        const mediumRisk = riskySignIns.filter(s => s.riskLevel === "medium");
        const lowRisk = riskySignIns.filter(s => s.riskLevel === "low");
        IPC.log(`  - ${highRisk.length} high-risk events`, "error");
        IPC.log(`  - ${mediumRisk.length} medium-risk events`, "warn");
        IPC.log(`  - ${lowRisk.length} low-risk events`, "info");
        if (riskySignIns.length === 0) {
            IPC.success({
                message: `No risky sign-ins detected in last ${days} days`,
                table: {
                    headers: ["Status"],
                    rows: [["All sign-ins appear normal"]],
                },
            });
        }
        else {
            // Sort by risk level (high first) and timestamp (newest first)
            const sorted = riskySignIns.sort((a, b) => {
                const riskOrder = { high: 0, medium: 1, low: 2, none: 3 };
                if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
                    return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
                }
                return new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime();
            });
            const topEvents = sorted.slice(0, 20);
            IPC.success({
                message: `Risky Sign-In Report (${dryRun ? "DRY RUN" : "LIVE"})`,
                table: {
                    headers: ["Timestamp", "User", "Application", "IP Address", "Risk Level", "Risk Detail", "Status"],
                    rows: topEvents.map(event => [
                        new Date(event.createdDateTime).toLocaleString(),
                        event.userPrincipalName,
                        event.appDisplayName,
                        event.ipAddress || "N/A",
                        event.riskLevel === "high" ? "🔴 High" : event.riskLevel === "medium" ? "🟠 Medium" : "🟡 Low",
                        event.riskDetail || "Unknown",
                        event.status?.errorCode === 0 ? "Success" : "Failed",
                    ]),
                },
            });
            IPC.log(`Showing top 20 risky events (${riskySignIns.length} total)`, "info");
            IPC.log("Recommendation: Investigate high-risk sign-ins and enforce MFA for affected users", "warn");
        }
    }
    catch (error) {
        IPC.error(`Risky sign-in detection failed: ${error.message}`);
        IPC.log("Note: Requires Azure AD Premium P2 license for Identity Protection", "info");
    }
}
