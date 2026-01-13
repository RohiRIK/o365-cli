import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
import * as fs from "fs";
import * as path from "path";
export async function auditIntuneAssignments(dryRun = true, exportPath) {
    IPC.progress("Starting Deep Intune Configuration Audit...", 0);
    const client = GraphService.getClient();
    const tableData = [];
    const groupCache = {};
    async function getGroupName(groupId) {
        if (groupCache[groupId])
            return groupCache[groupId];
        try {
            const group = await client.api(`/groups/${groupId}`).select("displayName").get();
            groupCache[groupId] = group.displayName;
            return group.displayName;
        }
        catch {
            return groupId;
        }
    }
    async function resolveAssignments(endpoint, policyId, version = 'v1.0', policyType) {
        try {
            // MAM/App Protection logic: Hit specific entity sets for reliable assignment retrieval
            let actualEndpoint = endpoint;
            if (endpoint.includes("managedAppPolicies") && policyType) {
                const type = policyType.replace("#microsoft.graph.", "");
                // Map to correct entity set pluralization
                const entitySetMap = {
                    "iosManagedAppProtection": "iosManagedAppProtections",
                    "androidManagedAppProtection": "androidManagedAppProtections",
                    "defaultManagedAppProtection": "defaultManagedAppProtections",
                    "targetedManagedAppConfiguration": "targetedManagedAppConfigurations",
                    "managedAppConfiguration": "managedAppConfigurations",
                    "mdmAppConfig": "mdmAppConfigurations"
                };
                if (entitySetMap[type]) {
                    actualEndpoint = `/deviceAppManagement/${entitySetMap[type]}`;
                }
            }
            const assignmentsReq = await client.api(`${actualEndpoint}/${policyId}/assignments`).version(version).get();
            const assignments = assignmentsReq.value;
            if (!assignments || assignments.length === 0) {
                return { included: "None", excluded: "None" };
            }
            const includedNames = [];
            const excludedNames = [];
            for (const ass of assignments) {
                const target = ass.target;
                if (!target)
                    continue;
                const odataType = (target["@odata.type"] || "").toLowerCase();
                const isExclusion = odataType.includes("exclusion");
                let name = "Unknown";
                if (target.groupId) {
                    name = await getGroupName(target.groupId);
                }
                else if (odataType.includes("alldevices")) {
                    name = "All Devices";
                }
                else if (odataType.includes("alllicensedusers") || odataType.includes("allusers")) {
                    name = "All Users";
                }
                else if (odataType.includes("allapps")) {
                    name = "All Apps";
                }
                else if (odataType.includes("unmanageddevices")) {
                    name = "Unmanaged Devices";
                }
                else {
                    const type = odataType.split('.').pop() || "Other";
                    name = type.charAt(0).toUpperCase() + type.slice(1);
                }
                if (isExclusion) {
                    excludedNames.push(name);
                }
                else {
                    includedNames.push(name);
                }
            }
            return {
                included: includedNames.length > 0 ? includedNames.join(", ") : "None",
                excluded: excludedNames.length > 0 ? excludedNames.join(", ") : "None"
            };
        }
        catch {
            // Intent/Policy sets assignments use different structures
            if (endpoint.includes("intents")) {
                try {
                    const intentAssignments = await client.api(`/deviceManagement/intents/${policyId}/assignments`).version('beta').get();
                    if (intentAssignments.value) {
                        const included = [];
                        for (const a of intentAssignments.value) {
                            if (a.target?.groupId)
                                included.push(`Group: ${a.target.groupId}`);
                            else
                                included.push(a.target?.["@odata.type"]?.split('.').pop() || "Assigned");
                        }
                        return { included: included.join(", "), excluded: "N/A" };
                    }
                }
                catch { }
            }
            return { included: "None / N/A", excluded: "N/A" };
        }
    }
    try {
        const categories = [
            // Standard Configurations (v1.0)
            { name: "Device Config", endpoint: "/deviceManagement/deviceConfigurations", version: 'v1.0' },
            { name: "Compliance", endpoint: "/deviceManagement/deviceCompliancePolicies", version: 'v1.0' },
            { name: "GPO Analytics", endpoint: "/deviceManagement/groupPolicyConfigurations", version: 'v1.0' },
            // Modern Configurations (Beta is much more complete)
            { name: "Settings Catalog", endpoint: "/deviceManagement/configurationPolicies", version: 'beta' },
            { name: "Security Baseline", endpoint: "/deviceManagement/intents", version: 'beta' },
            // Scripts (Mix of v1.0 and Beta)
            { name: "PowerShell (Win)", endpoint: "/deviceManagement/deviceManagementScripts", version: 'v1.0' },
            { name: "Shell Script (Mac)", endpoint: "/deviceManagement/deviceShellScripts", version: 'beta' },
            { name: "Custom Attr (Mac)", endpoint: "/deviceManagement/deviceCustomAttributeShellScripts", version: 'beta' },
            { name: "Compliance Script", endpoint: "/deviceManagement/deviceComplianceScripts", version: 'beta' },
            { name: "Remediations", endpoint: "/deviceManagement/deviceHealthScripts", version: 'beta' },
            // Enrollment & Provisioning
            { name: "Autopilot Profile", endpoint: "/deviceManagement/windowsAutopilotDeploymentProfiles", version: 'v1.0' },
            { name: "Enrollment Config", endpoint: "/deviceManagement/deviceEnrollmentConfigurations", version: 'v1.0' },
            { name: "Update Rings", endpoint: "/deviceManagement/windowsUpdateRingConfigurations", version: 'v1.0' },
            // Endpoint Security Specific (Mostly Beta)
            { name: "ES: Antivirus", endpoint: "/deviceManagement/antivirusPolicies", version: 'beta' },
            { name: "ES: Firewall", endpoint: "/deviceManagement/firewallPolicies", version: 'beta' },
            { name: "ES: Encryption", endpoint: "/deviceManagement/diskEncryptionPolicies", version: 'beta' },
            { name: "ES: ASR", endpoint: "/deviceManagement/attackSurfaceReductionPolicies", version: 'beta' },
            { name: "ES: EDR", endpoint: "/deviceManagement/endpointDetectionAndResponseConfigurations", version: 'beta' },
            { name: "ES: Account Prot", endpoint: "/deviceManagement/accountProtectionPolicies", version: 'beta' },
            // Apps & App Protection (Beta is more accurate for assignments)
            { name: "App Protection", endpoint: "/deviceAppManagement/managedAppPolicies", version: 'beta' },
            { name: "App Config", endpoint: "/deviceAppManagement/mobileAppConfigurations", version: 'v1.0' },
            { name: "Managed Apps", endpoint: "/deviceAppManagement/mobileApps", version: 'beta' }
        ];
        let processed = 0;
        for (const cat of categories) {
            const progress = Math.round((processed / categories.length) * 100);
            IPC.progress(`Auditing ${cat.name}...`, progress);
            try {
                const policies = await GraphService.fetchAll(cat.endpoint, undefined, cat.version);
                for (const policy of policies) {
                    const { included, excluded } = await resolveAssignments(cat.endpoint, policy.id, cat.version, policy["@odata.type"]);
                    let modified = "N/A";
                    if (policy.lastModifiedDateTime) {
                        const date = new Date(policy.lastModifiedDateTime);
                        // Filter out "built-in" dates (0001-01-01)
                        if (date.getFullYear() < 1900) {
                            modified = "Built-in";
                        }
                        else {
                            modified = date.toLocaleString();
                        }
                    }
                    tableData.push([
                        policy.displayName || policy.name || "Unknown",
                        cat.name,
                        included,
                        excluded,
                        modified
                    ]);
                }
            }
            catch (e) {
                // If it's a 403, it means the user definitely needs to re-login
                if (e.message.includes("403") || e.message.includes("authorized")) {
                    IPC.log(`Access Denied for ${cat.name}: ${e.message}`, "error");
                }
                else {
                    // IPC.log(`Skipped ${cat.name}: ${e.message}`, "warn");
                }
            }
            processed++;
        }
        IPC.progress("Ultimate Audit complete", 100);
        if (exportPath) {
            const outputDir = path.resolve(process.cwd(), "output");
            if (!fs.existsSync(outputDir))
                fs.mkdirSync(outputDir, { recursive: true });
            const fullPath = path.resolve(outputDir, exportPath);
            const csv = [
                ["Policy Name", "Type", "Included", "Excluded", "Modified"].join(","),
                ...tableData.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join("\n");
            fs.writeFileSync(fullPath, csv);
            IPC.log(`Exported results to ${fullPath}`, "info");
        }
        IPC.success({
            message: `Intune Ultimate Audit: Found ${tableData.length} total configurations and scripts.`,
            table: {
                headers: ["Policy Name", "Type", "Included", "Excluded", "Modified"],
                rows: tableData
            }
        });
    }
    catch (error) {
        IPC.error(`Ultimate Audit failed: ${error.message}`);
    }
}
