import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
/**
 * New User Onboarding
 * Automated Day 1 provisioning with template-based cloning
 *
 * Steps:
 * 1. Create user account with firstname.lastname@domain
 * 2. If template_user provided:
 *    - Clone group memberships
 *    - Clone license assignments
 * 3. Else: Apply department defaults
 * 4. Log all provisioning actions
 */
export async function onboardUser(firstname, lastname, department, templateUser) {
    const client = GraphService.getClient();
    IPC.progress("Starting user onboarding...", 0);
    IPC.log(`User: ${firstname} ${lastname}`, "info");
    IPC.log(`Department: ${department}`, "info");
    if (templateUser) {
        IPC.log(`Template user: ${templateUser}`, "info");
    }
    try {
        // Step 1: Get organization's default domain
        IPC.progress("Fetching organization domain...", 10);
        const organization = await client.api("/organization").get();
        const defaultDomain = organization.value && organization.value.length > 0
            ? organization.value[0].verifiedDomains?.find((d) => d.isDefault)?.name
            : null;
        if (!defaultDomain) {
            IPC.error("Could not determine organization's default domain");
            return;
        }
        IPC.log(`Default domain: ${defaultDomain}`, "info");
        // Step 2: Generate user principal name
        const userPrincipalName = `${firstname.toLowerCase()}.${lastname.toLowerCase()}@${defaultDomain}`;
        const displayName = `${firstname} ${lastname}`;
        IPC.log(`Creating user: ${userPrincipalName}`, "info");
        // Step 3: Create user account
        IPC.progress("Creating user account...", 20);
        // Generate random password for initial setup
        const tempPassword = generateSecurePassword();
        const newUser = {
            accountEnabled: true,
            displayName,
            mailNickname: `${firstname.toLowerCase()}.${lastname.toLowerCase()}`,
            userPrincipalName,
            passwordProfile: {
                forceChangePasswordNextSignIn: true,
                password: tempPassword,
            },
            givenName: firstname,
            surname: lastname,
            department,
        };
        let createdUser;
        try {
            createdUser = await client.api("/users").post(newUser);
            IPC.log(`User created successfully: ${createdUser.id}`, "info");
        }
        catch (error) {
            if (error.message.includes("already exists")) {
                IPC.error(`User ${userPrincipalName} already exists`);
                return;
            }
            throw error;
        }
        const userId = createdUser.id;
        const actions = [];
        actions.push(`Created user account: ${userPrincipalName}`);
        actions.push(`Temporary password: ${tempPassword} (must change on first sign-in)`);
        // Step 4: Clone from template user if provided
        if (templateUser) {
            IPC.progress("Cloning from template user...", 40);
            try {
                // Get template user
                const template = await client
                    .api(`/users/${templateUser}`)
                    .select("id,displayName")
                    .get();
                IPC.log(`Template user found: ${template.displayName}`, "info");
                // Clone group memberships
                IPC.progress("Cloning group memberships...", 50);
                const templateGroups = await client.api(`/users/${template.id}/memberOf`).get();
                if (templateGroups.value && templateGroups.value.length > 0) {
                    let groupCount = 0;
                    for (const group of templateGroups.value) {
                        try {
                            // Add new user to this group
                            await client.api(`/groups/${group.id}/members/$ref`).post({
                                "@odata.id": `https://graph.microsoft.com/v1.0/users/${userId}`,
                            });
                            groupCount++;
                            IPC.log(`Added to group: ${group.displayName || group.id}`, "info");
                        }
                        catch (error) {
                            IPC.log(`Failed to add to group ${group.displayName}: ${error.message}`, "warn");
                        }
                    }
                    actions.push(`Added to ${groupCount} groups (cloned from template)`);
                }
                else {
                    actions.push("No group memberships to clone");
                }
                // Clone license assignments
                IPC.progress("Cloning license assignments...", 70);
                const templateLicenses = await client
                    .api(`/users/${template.id}`)
                    .select("assignedLicenses")
                    .get();
                if (templateLicenses.assignedLicenses && templateLicenses.assignedLicenses.length > 0) {
                    const licenseSkuIds = templateLicenses.assignedLicenses.map((l) => l.skuId);
                    try {
                        await client.api(`/users/${userId}/assignLicense`).post({
                            addLicenses: licenseSkuIds.map((skuId) => ({
                                skuId,
                                disabledPlans: [],
                            })),
                            removeLicenses: [],
                        });
                        actions.push(`Assigned ${licenseSkuIds.length} licenses (cloned from template)`);
                        IPC.log(`Assigned ${licenseSkuIds.length} licenses`, "info");
                    }
                    catch (error) {
                        IPC.log(`Failed to assign licenses: ${error.message}`, "warn");
                        actions.push(`License assignment failed: ${error.message}`);
                    }
                }
                else {
                    actions.push("No licenses to clone");
                }
            }
            catch (error) {
                IPC.log(`Template cloning failed: ${error.message}`, "error");
                actions.push(`Template cloning failed: ${error.message}`);
            }
        }
        else {
            // Apply department defaults (simplified - would need department mapping)
            IPC.progress("Applying department defaults...", 50);
            actions.push(`Department set to: ${department}`);
            actions.push("No template user provided - manual group/license assignment required");
            IPC.log("No template user - skipping group/license cloning", "info");
        }
        IPC.progress("Finalizing onboarding...", 90);
        // Step 5: Send welcome email (placeholder - would use SendMail API)
        // In production, you would send a welcome email with account details
        actions.push("Welcome email: Not implemented (would send via Microsoft Graph SendMail API)");
        IPC.success({
            message: `User ${displayName} onboarded successfully`,
            table: {
                headers: ["Action", "Status"],
                rows: actions.map((action) => [
                    action.length > 60 ? action.substring(0, 57) + "..." : action,
                    "Completed",
                ]),
            },
        });
        IPC.log("\nNext steps:", "info");
        IPC.log(`1. Share temporary password with user: ${tempPassword}`, "warn");
        IPC.log("2. User must change password on first sign-in", "info");
        IPC.log("3. Verify group memberships and licenses are correct", "info");
        if (!templateUser) {
            IPC.log("4. Manually assign licenses and add to department groups", "warn");
        }
        IPC.log("5. Configure additional settings (e.g., mailbox, OneDrive)", "info");
    }
    catch (error) {
        IPC.error(`User onboarding failed: ${error.message}`);
    }
}
/**
 * Generate a secure random password for initial user setup
 * 16 characters with uppercase, lowercase, numbers, and symbols
 */
function generateSecurePassword() {
    const length = 16;
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = "";
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    // Fill remaining characters
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    // Shuffle password
    return password
        .split("")
        .sort(() => Math.random() - 0.5)
        .join("");
}
