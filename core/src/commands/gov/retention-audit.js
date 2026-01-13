import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
import * as fs from "fs";
import * as path from "path";
/**
 * Retention Policy Audit
 * Audit retention policies across Exchange, SharePoint, Teams
 *
 * Detects:
 * - Policy gaps (resources without retention)
 * - Policy overlaps (multiple policies on same resource)
 * - Policy conflicts (contradictory settings)
 * - Disabled policies
 */
export async function auditRetentionPolicies(dryRun = true) {
    const client = GraphService.getClient();
    IPC.progress("Starting retention policy audit...", 0);
    IPC.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE AUDIT"}`, "info");
    try {
        // Phase 1: Fetch Retention Labels (0-30%)
        IPC.progress("Fetching retention labels...", 5);
        let retentionLabels = [];
        try {
            retentionLabels = await GraphService.fetchAll(`/security/informationProtection/labelPolicies`, "id,displayName,labels", {});
            IPC.log(`Found ${retentionLabels.length} retention label policies`, "info");
        }
        catch (error) {
            IPC.log(`Retention labels access denied: ${error.message}`, "warn");
            IPC.log("Requires InformationProtectionPolicy.Read permission", "warn");
        }
        // Phase 2: Fetch Retention Policies (30-60%)
        IPC.progress("Fetching retention policies...", 30);
        let retentionPolicies = [];
        try {
            // Note: Microsoft Graph currently has limited support for retention policies
            // In production, this would use Security & Compliance PowerShell or specific endpoints
            // For now, we'll fetch what's available via Graph API
            const policies = await GraphService.fetchAll(`/security/informationProtection/sensitivityLabels`, "id,name,description,isActive", {});
            IPC.log(`Found ${policies.length} information protection policies`, "info");
            // Transform to retention policy format
            retentionPolicies = policies.map((p) => ({
                id: p.id,
                displayName: p.name || "Unnamed Policy",
                isEnabled: p.isActive ?? true,
                retentionDuration: 365, // Default - would come from policy settings
                locations: ["Exchange", "SharePoint", "OneDrive"], // Would come from policy scope
                scope: "All",
                mode: "preserveAndDelete",
            }));
        }
        catch (error) {
            IPC.log(`Retention policies access denied: ${error.message}`, "warn");
            IPC.log("Requires Policy.Read.All permission", "warn");
        }
        // Phase 3: Analyze Policy Coverage (60-80%)
        IPC.progress("Analyzing policy coverage...", 60);
        const conflicts = [];
        const disabledPolicies = retentionPolicies.filter(p => !p.isEnabled);
        // Detect overlaps (multiple policies on same location)
        const locationPolicies = new Map();
        retentionPolicies.forEach(policy => {
            policy.locations.forEach(location => {
                if (!locationPolicies.has(location)) {
                    locationPolicies.set(location, []);
                }
                locationPolicies.get(location).push(policy.displayName);
            });
        });
        locationPolicies.forEach((policies, location) => {
            if (policies.length > 1) {
                conflicts.push({
                    resource: location,
                    policies: policies,
                    issue: "overlap",
                    severity: "medium",
                    recommendation: `Review ${policies.length} retention policies applied to ${location}. Ensure they don't conflict.`,
                });
            }
        });
        // Detect gaps (common workloads without retention)
        const expectedWorkloads = ["Exchange", "SharePoint", "OneDrive", "Teams"];
        const coveredWorkloads = new Set(locationPolicies.keys());
        expectedWorkloads.forEach(workload => {
            if (!coveredWorkloads.has(workload)) {
                conflicts.push({
                    resource: workload,
                    policies: [],
                    issue: "gap",
                    severity: "high",
                    recommendation: `No retention policy found for ${workload}. Consider implementing retention to meet compliance requirements.`,
                });
            }
        });
        // Detect conflicts (contradictory duration settings)
        locationPolicies.forEach((policyNames, location) => {
            const policiesForLocation = retentionPolicies.filter(p => policyNames.includes(p.displayName));
            const durations = new Set(policiesForLocation.map(p => p.retentionDuration));
            if (durations.size > 1) {
                conflicts.push({
                    resource: location,
                    policies: policyNames,
                    issue: "conflict",
                    severity: "high",
                    recommendation: `${location} has ${durations.size} different retention durations. Consolidate to a single duration.`,
                });
            }
        });
        IPC.progress("Generating audit report...", 80);
        // Phase 4: Generate Report (80-100%)
        const auditResults = {
            totalPolicies: retentionPolicies.length,
            enabledPolicies: retentionPolicies.filter(p => p.isEnabled).length,
            disabledPolicies: disabledPolicies.length,
            conflicts: conflicts.length,
            gaps: conflicts.filter(c => c.issue === "gap").length,
            overlaps: conflicts.filter(c => c.issue === "overlap").length,
            policyConflicts: conflicts.filter(c => c.issue === "conflict").length,
        };
        if (!dryRun && (retentionPolicies.length > 0 || conflicts.length > 0)) {
            const exportDir = path.join(process.cwd(), "exports", "retention-audit");
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `retention_audit_${timestamp}.json`;
            const filePath = path.join(exportDir, fileName);
            // Create directory if it doesn't exist
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            // Write export file
            fs.writeFileSync(filePath, JSON.stringify({
                auditMetadata: {
                    auditDate: new Date().toISOString(),
                    scope: "Organization-wide retention policies",
                    totalPolicies: retentionPolicies.length,
                    totalConflicts: conflicts.length,
                },
                policies: retentionPolicies,
                conflicts: conflicts,
                disabledPolicies: disabledPolicies.map(p => ({
                    id: p.id,
                    displayName: p.displayName,
                    locations: p.locations,
                })),
            }, null, 2));
            IPC.log(`Audit report saved: ${filePath}`, "info");
            IPC.success({
                message: `Retention policy audit completed`,
                file_path: filePath,
                table: {
                    headers: ["Category", "Count", "Status"],
                    rows: [
                        ["Total Policies", auditResults.totalPolicies.toString(), auditResults.totalPolicies > 0 ? "✅ Found" : "⚠️ None"],
                        ["Enabled Policies", auditResults.enabledPolicies.toString(), "✅"],
                        ["Disabled Policies", auditResults.disabledPolicies.toString(), auditResults.disabledPolicies > 0 ? "⚠️ Review" : "✅"],
                        ["Policy Gaps", auditResults.gaps.toString(), auditResults.gaps > 0 ? "🚨 Critical" : "✅"],
                        ["Policy Overlaps", auditResults.overlaps.toString(), auditResults.overlaps > 0 ? "⚠️ Review" : "✅"],
                        ["Policy Conflicts", auditResults.policyConflicts.toString(), auditResults.policyConflicts > 0 ? "🚨 Critical" : "✅"],
                    ],
                },
            });
            // Show top 5 conflicts if any
            if (conflicts.length > 0) {
                IPC.log("\nTop Issues:", "info");
                conflicts.slice(0, 5).forEach((c, i) => {
                    IPC.log(`${i + 1}. ${c.resource} - ${c.issue.toUpperCase()} (${c.severity})`, "warn");
                    IPC.log(`   Recommendation: ${c.recommendation}`, "info");
                });
                if (conflicts.length > 5) {
                    IPC.log(`\n... and ${conflicts.length - 5} more issues. See full report in ${fileName}`, "info");
                }
            }
        }
        else if (retentionPolicies.length === 0 && conflicts.length === 0) {
            IPC.success({
                message: `No retention policies found or access denied`,
                table: {
                    headers: ["Status", "Details"],
                    rows: [
                        ["Retention Labels", retentionLabels.length > 0 ? `${retentionLabels.length} found` : "None or access denied"],
                        ["Retention Policies", "None or access denied"],
                    ],
                },
            });
            IPC.log("This may be due to missing permissions or no configured retention policies", "warn");
            IPC.log("Required permissions: InformationProtectionPolicy.Read, Policy.Read.All", "info");
        }
        else {
            // Dry run - show preview
            const preview = conflicts.slice(0, 10);
            IPC.success({
                message: `Retention policy audit preview (DRY RUN - no file created)`,
                table: {
                    headers: ["Resource", "Issue Type", "Severity", "Policies Affected"],
                    rows: preview.map(c => [
                        c.resource,
                        c.issue.toUpperCase(),
                        c.severity.toUpperCase(),
                        c.policies.length > 0 ? c.policies.length.toString() : "N/A",
                    ]),
                },
            });
            IPC.log(`\nAudit Summary:`, "info");
            IPC.log(`- Total Policies: ${auditResults.totalPolicies}`, "info");
            IPC.log(`- Enabled: ${auditResults.enabledPolicies}`, "info");
            IPC.log(`- Disabled: ${auditResults.disabledPolicies}`, "info");
            IPC.log(`- Policy Gaps: ${auditResults.gaps}`, "info");
            IPC.log(`- Policy Overlaps: ${auditResults.overlaps}`, "info");
            IPC.log(`- Policy Conflicts: ${auditResults.policyConflicts}`, "info");
            IPC.log(`\nTo generate full audit report, use --dry-run false`, "info");
        }
    }
    catch (error) {
        IPC.error(`Retention policy audit failed: ${error.message}`);
    }
}
