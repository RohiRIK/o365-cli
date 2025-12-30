import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
import * as fs from "fs";
import * as path from "path";

interface Assignment {
    target: {
        groupId?: string;
        "@odata.type": string;
    };
}

interface Policy {
    id: string;
    displayName: string;
    "@odata.type": string;
    lastModifiedDateTime?: string;
}

export async function auditIntuneAssignments(dryRun: boolean = true, exportPath?: string) {
    IPC.progress("Starting Deep Intune Configuration Audit...", 0);
    const client = GraphService.getClient();
    
    const tableData: any[][] = [];
    const groupCache: Record<string, string> = {};

    async function getGroupName(groupId: string): Promise<string> {
        if (groupCache[groupId]) return groupCache[groupId];
        try {
            const group = await client.api(`/groups/${groupId}`).select("displayName").get();
            groupCache[groupId] = group.displayName;
            return group.displayName;
        } catch {
            return groupId;
        }
    }

    async function resolveAssignments(endpoint: string, policyId: string): Promise<string> {
        try {
            const assignmentsReq = await client.api(`${endpoint}/${policyId}/assignments`).get();
            const assignments = assignmentsReq.value as Assignment[];
            
            const names: string[] = [];
            for (const ass of assignments) {
                if (ass.target.groupId) {
                    names.push(await getGroupName(ass.target.groupId));
                } else if (ass.target["@odata.type"]?.includes("AllDevicesAssignmentTarget")) {
                    names.push("All Devices");
                } else if (ass.target["@odata.type"]?.includes("AllLicensedUsersAssignmentTarget")) {
                    names.push("All Users");
                }
            }
            return names.join(", ") || "None";
        } catch {
            return "None / N/A";
        }
    }

    try {
        const categories = [
            { name: "Device Config", endpoint: "/deviceManagement/deviceConfigurations" },
            { name: "Compliance", endpoint: "/deviceManagement/deviceCompliancePolicies" },
            { name: "Settings Catalog", endpoint: "/deviceManagement/configurationPolicies" },
            { name: "GPO Analytics", endpoint: "/deviceManagement/groupPolicyConfigurations" },
            { name: "Autopilot Profile", endpoint: "/deviceManagement/windowsAutopilotDeploymentProfiles" },
            { name: "Enrollment Config", endpoint: "/deviceManagement/deviceEnrollmentConfigurations" },
            { name: "PowerShell (Win)", endpoint: "/deviceManagement/deviceManagementScripts" },
            { name: "Shell Script (Mac)", endpoint: "/deviceManagement/deviceShellScripts" },
            { name: "App Protection (iOS)", endpoint: "/deviceAppManagement/iosManagedAppProtections" },
            { name: "App Protection (Android)", endpoint: "/deviceAppManagement/androidManagedAppProtections" },
            { name: "App Config Policy", endpoint: "/deviceAppManagement/mobileAppConfigurations" },
            { name: "ES: Antivirus", endpoint: "/deviceManagement/antivirusPolicies" },
            { name: "ES: Firewall", endpoint: "/deviceManagement/firewallPolicies" },
            { name: "ES: Encryption", endpoint: "/deviceManagement/diskEncryptionPolicies" },
            { name: "ES: ASR", endpoint: "/deviceManagement/attackSurfaceReductionPolicies" },
            { name: "ES: EDR", endpoint: "/deviceManagement/endpointDetectionAndResponseConfigurations" },
            { name: "Managed Apps", endpoint: "/deviceAppManagement/mobileApps" }
        ];

        let processed = 0;
        for (const cat of categories) {
            const progress = Math.round((processed / categories.length) * 100);
            IPC.progress(`Auditing ${cat.name}...`, progress);
            
            try {
                const policies = await GraphService.fetchAll<Policy>(cat.endpoint);
                for (const policy of policies) {
                    const assigned = await resolveAssignments(cat.endpoint, policy.id);
                    const modified = policy.lastModifiedDateTime 
                        ? new Date(policy.lastModifiedDateTime).toLocaleString() 
                        : "N/A";
                    
                    tableData.push([
                        policy.displayName || "Unknown",
                        cat.name,
                        assigned,
                        modified
                    ]);
                }
            } catch (e: any) {
                // Silently skip if endpoint not accessible
            }
            processed++;
        }

        IPC.progress("Deep Audit complete", 100);

        // Handle Export if requested
        if (exportPath) {
            const fullPath = path.resolve(process.cwd(), exportPath);
            const csv = [
                ["Policy Name", "Type", "Assigned To", "Modified"].join(","),
                ...tableData.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join("\n");
            
            fs.writeFileSync(fullPath, csv);
            IPC.log(`Exported results to ${fullPath}`, "info");
        }

        IPC.success({
            message: `Intune Audit: Found ${tableData.length} total configurations, scripts, and profiles.`, 
            table: {
                headers: ["Policy Name", "Type", "Assigned To", "Modified"],
                rows: tableData
            }
        });

    } catch (error: any) {
        IPC.error(`Deep Audit failed: ${error.message}`);
    }
}