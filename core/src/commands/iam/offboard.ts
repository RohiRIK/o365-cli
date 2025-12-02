import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

interface OffboardParams {
  email: string;
  managerEmail: string;
  dryRun?: boolean;
}

export async function offboardUser(email: string, managerEmail?: string, dryRun: boolean = true) {
  IPC.progress(`Starting graceful offboarding for ${email}...`, 0);
  const client = GraphService.getClient();

  try {
    // Step 1: Verify user exists
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

    // Step 2: Block sign-in (disable account)
    IPC.progress("Checking account status...", 20);
    if (user.accountEnabled) {
      if (dryRun) {
        actions.push(`[DRY-RUN] Would disable sign-in for ${displayName}`);
      } else {
        await client.api(`/users/${userId}`)
          .update({ accountEnabled: false });
        actions.push(`✅ Disabled sign-in for ${displayName}`);
      }
    } else {
      actions.push(`ℹ️ Sign-in already disabled for ${displayName}`);
    }

    // Step 3: Remove licenses
    IPC.progress("Processing license removal...", 40);
    if (user.assignedLicenses && user.assignedLicenses.length > 0) {
      const licenseSkuIds = user.assignedLicenses.map((lic: any) => lic.skuId);
      
      if (dryRun) {
        actions.push(`[DRY-RUN] Would remove ${licenseSkuIds.length} license(s)`);
      } else {
        await client.api(`/users/${userId}/assignLicense`)
          .post({
            addLicenses: [],
            removeLicenses: licenseSkuIds
          });
        actions.push(`✅ Removed ${licenseSkuIds.length} license(s)`);
      }
    } else {
      actions.push(`ℹ️ No licenses assigned to ${displayName}`);
    }

    // Step 4: Manager delegation (if provided)
    if (managerEmail) {
      IPC.progress("Configuring manager delegation...", 60);
      
      // Verify manager exists
      try {
        const manager = await client.api(`/users/${managerEmail}`)
          .select("id,displayName")
          .get();

        if (dryRun) {
          actions.push(`[DRY-RUN] Would grant ${manager.displayName} access to mailbox`);
          actions.push(`[DRY-RUN] Note: Mailbox conversion to Shared requires Exchange PowerShell`);
        } else {
          actions.push(`⚠️ Manager delegation requires Exchange Online PowerShell (not yet implemented)`);
          actions.push(`   Manual step: Run 'Add-MailboxPermission -Identity ${email} -User ${managerEmail} -AccessRights FullAccess'`);
        }
      } catch (err) {
        actions.push(`⚠️ Manager ${managerEmail} not found - skipping delegation`);
      }
    }

    // Step 5: Mailbox conversion note
    IPC.progress("Finalizing offboarding...", 80);
    actions.push(`⚠️ Mailbox conversion to Shared Mailbox requires Exchange Online PowerShell`);
    actions.push(`   Manual step: Run 'Set-Mailbox -Identity ${email} -Type Shared'`);

    IPC.progress("Offboarding complete", 100);

    // Return results as table
    IPC.success({
      message: dryRun ? "Offboarding Preview (Dry Run)" : "Offboarding Complete",
      table: {
        headers: ["Action", "Status"],
        rows: actions.map(action => {
          const match = action.match(/^(\[DRY-RUN\]|✅|ℹ️|⚠️)\s*(.+)$/);
          if (match) {
            return [match[1], match[2]];
          }
          return ["", action];
        })
      }
    });

  } catch (error: any) {
    IPC.error(error.message || "Unknown error during offboarding");
  }
}
