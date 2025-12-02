import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

export async function offboardUser(email: string, managerEmail?: string, dryRun: boolean = true) {
  IPC.progress(`Starting graceful offboarding for ${email}...`, 0);
  const client = GraphService.getClient();

  try {
    // === STEP 1: DISCOVERY ===
    IPC.progress("Searching for user in Entra ID...", 10);
    const user = await client.api(`/users/${email}`)
      .select("id,displayName,userPrincipalName,accountEnabled,assignedLicenses,mail")
      .get();

    if (!user) {
      IPC.error(`User ${email} not found in Entra ID.`);
      return;
    }

    const userId = user.id;
    const displayName = user.displayName;
    const actions: string[] = [];

    // Resolve Manager Name (if provided) for Auto-Reply
    let managerName = "my manager";
    if (managerEmail) {
        try {
            const mgr = await client.api(`/users/${managerEmail}`).select("displayName").get();
            managerName = mgr.displayName;
        } catch (e) {
            actions.push(`⚠️ Manager ${managerEmail} not found - continuing without delegation`);
            managerEmail = undefined;
        }
    }

    // === STEP 2: IDENTITY LOCKDOWN ===
    
    // A. Block Sign-in
    IPC.progress("Locking Identity (Block Sign-in)...", 20);
    if (user.accountEnabled) {
      if (dryRun) {
        actions.push(`[DRY-RUN] Would disable sign-in for ${displayName}`);
      } else {
        await client.api(`/users/${userId}`).update({ accountEnabled: false });
        actions.push(`✅ Disabled sign-in for ${displayName}`);
      }
    } else {
      actions.push(`ℹ️ Sign-in already disabled`);
    }

    // B. Revoke Sessions (Kill Switch)
    IPC.progress("Locking Identity (Revoking Tokens)...", 30);
    if (dryRun) {
        actions.push(`[DRY-RUN] Would revoke all active refresh tokens (Sign-out all devices)`);
    } else {
        await client.api(`/users/${userId}/revokeSignInSessions`).post({});
        actions.push(`✅ Revoked all active sessions`);
    }

    // === STEP 3: DEVICE CLEANUP (Intune) ===
    IPC.progress("Scanning Managed Devices...", 40);
    try {
        const devicesReq = await client.api(`/users/${userId}/managedDevices`)
            .select("id,deviceName,operatingSystem,managedDeviceOwnerType")
            .get();
        const devices = devicesReq.value;

        if (devices.length > 0) {
            for (const dev of devices) {
                const actionDesc = `Retire (Wipe Company Data) on ${dev.deviceName} (${dev.operatingSystem})`;
                if (dryRun) {
                    actions.push(`[DRY-RUN] Would execute: ${actionDesc}`);
                } else {
                    await client.api(`/deviceManagement/managedDevices/${dev.id}/retire`).post({});
                    actions.push(`✅ Executed: ${actionDesc}`);
                }
            }
        } else {
            actions.push(`ℹ️ No managed devices found`);
        }
    } catch (e: any) {
        actions.push(`⚠️ Failed to scan devices: ${e.message}`);
    }

    // === STEP 4: MAILBOX & EXCHANGE ===
    
    // A. Set Auto-Reply
    IPC.progress("Configuring Mailbox Settings...", 50);
    const autoReplyMessage = `
        <html><body>
        <p>Hello,</p>
        <p>I have left the organization. Please contact <b>${managerName}</b> (${managerEmail || "support"}) for assistance.</p>
        </body></html>
    `;
    
    if (dryRun) {
        actions.push(`[DRY-RUN] Would set 'Internal' and 'External' OOF message pointing to ${managerName}`);
    } else {
        try {
            await client.api(`/users/${userId}/mailboxSettings`).update({
                automaticRepliesSetting: {
                    status: "alwaysEnabled",
                    externalAudience: "all",
                    internalReplyMessage: autoReplyMessage,
                    externalReplyMessage: autoReplyMessage
                }
            });
            actions.push(`✅ Set Auto-Reply (Out of Office)`);
        } catch (e: any) {
            actions.push(`⚠️ Failed to set Auto-Reply (User might not have a mailbox): ${e.message}`);
        }
    }

    // B. Mailbox Preservation & Delegation Note
    actions.push(`⚠️ MANUAL STEP REQUIRED: Convert to Shared Mailbox`);
    actions.push(`   > Exchange PS: Set-Mailbox -Identity ${email} -Type Shared`);
    
    if (managerEmail) {
        actions.push(`⚠️ MANUAL STEP REQUIRED: Grant Manager Access`);
        actions.push(`   > Exchange PS: Add-MailboxPermission -Identity ${email} -User ${managerEmail} -AccessRights FullAccess -AutoMapping $true`);
    }

    // === STEP 5: LICENSE RECLAMATION ===
    // Note: Should be done AFTER mailbox conversion to avoid data loss in some scenarios, 
    // but Graph API doesn't support conversion yet. 
    // We will proceed but warn.
    
    IPC.progress("Processing License Removal...", 80);
    if (user.assignedLicenses && user.assignedLicenses.length > 0) {
      const licenseSkuIds = user.assignedLicenses.map((lic: any) => lic.skuId);
      
      if (dryRun) {
        actions.push(`[DRY-RUN] Would remove ${licenseSkuIds.length} license(s) (SKUs: ${licenseSkuIds.join(", ")})`);
      } else {
        // Safety check: In a real automation, we might wait for shared mailbox conversion.
        // For this tool, we'll assume the admin handled the manual step or accepts the soft-delete risk (30 days recovery).
        await client.api(`/users/${userId}/assignLicense`)
          .post({
            addLicenses: [],
            removeLicenses: licenseSkuIds
          });
        actions.push(`✅ Removed ${licenseSkuIds.length} license(s)`);
      }
    } else {
      actions.push(`ℹ️ No licenses found to remove`);
    }

    IPC.progress("Offboarding complete", 100);

    // Return results as table
    IPC.success({
      message: dryRun ? "Offboarding Preview (Dry Run)" : "Offboarding Actions Executed",
      table: {
        headers: ["Action Type", "Detail"],
        rows: actions.map(action => {
          // Simple regex to split the status icon/tag from the message
          const match = action.match(/^(\[DRY-RUN\]|✅|ℹ️|⚠️)\s*(.+)$/);
          if (match) {
            return [match[1], match[2]];
          }
          return ["INFO", action];
        })
      }
    });

  } catch (error: any) {
    IPC.error(error.message || "Unknown error during offboarding");
  }
}
