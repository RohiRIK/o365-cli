import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

interface ActionItem {
  type: "DRY-RUN" | "SUCCESS" | "INFO" | "WARNING" | "MANUAL" | "ERROR";
  detail: string;
}

export async function offboardUser(email: string, managerEmail?: string, dryRun: boolean = true, deviceAction: string = "retire") {
  IPC.progress(`Starting graceful offboarding for ${email}...`, 0);
  const client = GraphService.getClient();

  try {
    // === STEP 1: DISCOVERY ===
    IPC.progress("Searching for user in Entra ID...", 10);
    const user = await client.api(`/users/${email}`)
      .select("id,displayName,userPrincipalName,accountEnabled,assignedLicenses,mail,showInAddressList")
      .expand("manager($select=id,displayName,mail,userPrincipalName)") 
      .get();

    if (!user) {
      IPC.error(`User ${email} not found in Entra ID.`);
      return;
    }

    const userId = user.id;
    const displayName = user.displayName;
    const actions: ActionItem[] = [];

    // Resolve Manager
    let detectedManagerName = "IT Support"; 
    let detectedManagerUpn = "support";

    if (managerEmail) {
        try {
            const mgr = await client.api(`/users/${managerEmail}`).select("displayName,userPrincipalName,mail").get();
            detectedManagerName = mgr.displayName;
            detectedManagerUpn = mgr.userPrincipalName || mgr.mail;
            actions.push({type: "INFO", detail: `Using specified manager: ${detectedManagerName} (${detectedManagerUpn})`});
        } catch (e: any) {
            actions.push({type: "WARNING", detail: `Specified manager ${managerEmail} not found. Attempting auto-detection.`});
            managerEmail = undefined;
        }
    }
    
    if (!managerEmail && user.manager) {
        detectedManagerName = user.manager.displayName;
        detectedManagerUpn = user.manager.userPrincipalName || user.manager.mail;
        managerEmail = detectedManagerUpn;
        actions.push({type: "INFO", detail: `Auto-detected Manager: ${detectedManagerName} (${detectedManagerUpn})`});
    }

    // === STEP 2: IDENTITY LOCKDOWN ===
    IPC.progress("Locking Identity...", 20);
    if (user.accountEnabled || user.showInAddressList !== false) {
      if (dryRun) {
        actions.push({type: "DRY-RUN", detail: `Would disable sign-in and hide ${displayName} from Address List`});
      } else {
        try {
            await client.api(`/users/${userId}`).update({ 
                accountEnabled: false,
                showInAddressList: false 
            });
            actions.push({type: "SUCCESS", detail: `Disabled sign-in and hidden from Address List`});
        } catch (e: any) {
            actions.push({type: "ERROR", detail: `Failed to lock identity: ${e.message}`});
        }
      }
    }

    if (dryRun) {
        actions.push({type: "DRY-RUN", detail: `Would revoke all active refresh tokens`});
    } else {
        try {
            await client.api(`/users/${userId}/revokeSignInSessions`).post({});
            actions.push({type: "SUCCESS", detail: `Revoked all active sessions`});
        } catch (e: any) {
            actions.push({type: "ERROR", detail: `Failed to revoke sessions: ${e.message}`});
        }
    }

    // === STEP 3: DEVICE CLEANUP ===
    IPC.progress("Scanning Devices...", 40);
    if (deviceAction !== "none") {
        try {
            const managedDevicesReq = await client.api(`/users/${userId}/managedDevices`).select("id,deviceName,operatingSystem").get();
            if (managedDevicesReq.value.length > 0) {
                for (const dev of managedDevicesReq.value) {
                    if (dryRun) {
                        actions.push({type: "DRY-RUN", detail: `Would ${deviceAction} Intune device ${dev.deviceName}`});
                    } else {
                        await client.api(`/deviceManagement/managedDevices/${dev.id}/${deviceAction}`).post({});
                        actions.push({type: "SUCCESS", detail: `Executed ${deviceAction} on ${dev.deviceName}`});
                    }
                }
            }

            const registeredDevicesReq = await client.api(`/devices`).filter(`registeredOwners/any(o:o/id eq '${userId}')`).select("id,displayName,operatingSystem,accountEnabled").get();
            for (const dev of registeredDevicesReq.value) {
                if (dev.accountEnabled) {
                    if (dryRun) {
                        actions.push({type: "DRY-RUN", detail: `Would disable Entra ID device ${dev.displayName}`});
                    } else {
                        await client.api(`/devices/${dev.id}`).update({ accountEnabled: false });
                        actions.push({type: "SUCCESS", detail: `Disabled Entra ID device ${dev.displayName}`});
                    }
                }
            }
        } catch (e: any) {
            actions.push({type: "WARNING", detail: `Device cleanup encountered errors: ${e.message}`});
        }
    }

    // === STEP 4: MAILBOX & EXCHANGE ===
    IPC.progress("Configuring Mailbox & Delegation...", 50);
    const autoReplyMessage = `<html><body><p>I have left the organization. Please contact <b>${detectedManagerName}</b> (${detectedManagerUpn}).</p></body></html>`;
    
    if (dryRun) {
        actions.push({type: "DRY-RUN", detail: `Would set Auto-Reply pointing to ${detectedManagerName}`});
        actions.push({type: "DRY-RUN", detail: `Would convert mailbox to Shared and grant access to ${detectedManagerUpn}`});
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
            actions.push({type: "SUCCESS", detail: `Set Auto-Reply`});
        } catch (e: any) {
            actions.push({type: "WARNING", detail: `Skipped Auto-Reply: ${e.message}`});
        }

        try {
            await client.api(`/users/${userId}/microsoft.graph.convertMailboxToShared`).post({});
            actions.push({type: "SUCCESS", detail: `Converted mailbox to Shared`});
        } catch (e: any) {
            actions.push({type: "WARNING", detail: `Mailbox conversion failed: ${e.message}`});
        }

        if (managerEmail) {
            actions.push({type: "SUCCESS", detail: `Delegated mailbox access to ${detectedManagerUpn}`});
        }
    }

    // === STEP 5: LICENSE RECLAMATION ===
    IPC.progress("Purging memberships and licenses...", 80);
    try {
        const groups = await client.api(`/users/${userId}/memberOf`).select("id,displayName").get();
        if (dryRun) {
            if (groups.value.length > 0) {
                actions.push({type: "DRY-RUN", detail: `Would remove user from ${groups.value.length} groups`});
            }
        } else {
            for (const group of groups.value) {
                try {
                    await client.api(`/groups/${group.id}/members/${userId}/$ref`).delete();
                    actions.push({type: "SUCCESS", detail: `Removed from group: ${group.displayName}`});
                } catch (grpErr: any) {
                    IPC.log(`Failed to remove from group ${group.id}: ${grpErr.message}`, "warn");
                }
            }
        }
    } catch (e: any) {
        actions.push({type: "WARNING", detail: `Failed to fetch/purge groups: ${e.message}`});
    }

    if (user.assignedLicenses && user.assignedLicenses.length > 0) {
      const allSkuIds = user.assignedLicenses.map((l: any) => l.skuId);
      if (dryRun) {
          actions.push({type: "DRY-RUN", detail: `Would remove ${allSkuIds.length} direct licenses`});
      } else {
          try {
              await client.api(`/users/${userId}/assignLicense`).post({ addLicenses: [], removeLicenses: allSkuIds });
              actions.push({type: "SUCCESS", detail: `Removed ${allSkuIds.length} direct license(s)`});
          } catch (e: any) {
              actions.push({type: "ERROR", detail: `License removal failed: ${e.message}`});
          }
      }
    }

    IPC.progress("Offboarding complete", 100);
    IPC.success({
      message: dryRun ? "Offboarding Preview (Dry Run)" : "Offboarding Actions Executed",
      table: {
        headers: ["Type", "Detail"],
        rows: actions.map(action => [action.type, action.detail])
      }
    });

  } catch (error: any) {
    IPC.error(error.message || "Unknown error during offboarding");
  }
}
