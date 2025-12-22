import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

interface ActionItem {
  type: "DRY-RUN" | "SUCCESS" | "INFO" | "WARNING" | "MANUAL" | "ERROR";
  detail: string;
}

export async function offboardUser(email: string, managerEmail?: string, dryRun: boolean = true) {
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
    } else if (!managerEmail) {
        actions.push({type: "WARNING", detail: `No manager found. Skipping delegation.`});
    }

    // === STEP 2: IDENTITY LOCKDOWN ===
    IPC.progress("Locking Identity...", 20);
    if (user.accountEnabled || user.showInAddressList !== false) {
      if (dryRun) {
        actions.push({type: "DRY-RUN", detail: `Would disable sign-in and hide ${displayName} from Address List`});
      } else {
        await client.api(`/users/${userId}`).update({ 
            accountEnabled: false,
            showInAddressList: false 
        });
        actions.push({type: "SUCCESS", detail: `Disabled sign-in and hidden from Address List`});
      }
    } else {
      actions.push({type: "INFO", detail: `Identity already locked and hidden`});
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
    try {
        // Intune Managed Devices
        const managedDevicesReq = await client.api(`/users/${userId}/managedDevices`)
            .select("id,deviceName,operatingSystem")
            .get();
        
        if (managedDevicesReq.value.length > 0) {
            for (const dev of managedDevicesReq.value) {
                const actionDesc = `Retire Intune device ${dev.deviceName} (${dev.operatingSystem})`;
                if (dryRun) {
                    actions.push({type: "DRY-RUN", detail: `Would execute: ${actionDesc}`});
                } else {
                    await client.api(`/deviceManagement/managedDevices/${dev.id}/retire`).post({});
                    actions.push({type: "SUCCESS", detail: `Executed: ${actionDesc}`});
                }
            }
        }

        // Entra ID Registered Devices
        const registeredDevicesReq = await client.api(`/devices`)
            .filter(`registeredOwners/any(o:o/id eq '${userId}')`)
            .select("id,displayName,operatingSystem,accountEnabled")
            .get();

        if (registeredDevicesReq.value.length > 0) {
            for (const dev of registeredDevicesReq.value) {
                if (dev.accountEnabled) {
                    const actionDesc = `Disable Entra ID device ${dev.displayName} (${dev.operatingSystem})`;
                    if (dryRun) {
                        actions.push({type: "DRY-RUN", detail: `Would execute: ${actionDesc}`});
                    } else {
                        await client.api(`/devices/${dev.id}`).update({ accountEnabled: false });
                        actions.push({type: "SUCCESS", detail: `Executed: ${actionDesc}`});
                    }
                }
            }
        }

        if (managedDevicesReq.value.length === 0 && registeredDevicesReq.value.length === 0) {
            actions.push({type: "INFO", detail: `No associated devices found`});
        }
    } catch (e: any) {
        const msg = e.message?.includes("Authorization_RequestDenied") ? "Missing Device Read/Write Permissions" : e.message;
        actions.push({type: "WARNING", detail: `Device scan failed: ${msg}`});
    }

    // === STEP 4: MAILBOX & EXCHANGE ===
    IPC.progress("Configuring Mailbox...", 50);
    const autoReplyMessage = `<html><body><p>I have left the organization. Please contact <b>${detectedManagerName}</b> (${detectedManagerUpn}).</p></body></html>`;
    
    if (dryRun) {
        actions.push({type: "DRY-RUN", detail: `Would set Auto-Reply pointing to ${detectedManagerName}`});
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
            actions.push({type: "WARNING", detail: `Skipped Auto-Reply (No mailbox or error): ${e.message}`});
        }
    }

    actions.push({type: "MANUAL", detail: `Convert to Shared Mailbox > Exchange PS: Set-Mailbox -Identity ${email} -Type Shared`});
    if (managerEmail) {
        actions.push({type: "MANUAL", detail: `Grant Manager Access > Exchange PS: Add-MailboxPermission -Identity ${email} -User ${managerEmail} -AccessRights FullAccess`});
    }

    // === STEP 5: LICENSE RECLAMATION (Group Aware) ===
    IPC.progress("Analyzing Licenses...", 80);
    if (user.assignedLicenses && user.assignedLicenses.length > 0) {
      
      const allSkuIds = user.assignedLicenses.map((l: any) => l.skuId);
      
      if (dryRun) {
          actions.push({type: "DRY-RUN", detail: `Would remove ${allSkuIds.length} licenses (checking for groups...)`});
      } else {
          try {
              IPC.log(`Attempting direct license removal for ${allSkuIds.length} SKUs...`);
              await client.api(`/users/${userId}/assignLicense`).post({
                  addLicenses: [],
                  removeLicenses: allSkuIds
              });
              actions.push({type: "SUCCESS", detail: `Removed ${allSkuIds.length} direct license(s)`});
          } catch (e: any) {
              IPC.log(`Direct removal failed: ${e.message}`);
              if (e.message.includes("inherited")) {
                  actions.push({type: "INFO", detail: `Some licenses are group-inherited. Scanning groups...`});
                  
                  // Fetch groups user is member of
                  IPC.log(`Fetching group memberships for ${userId}...`);
                  const groups = await client.api(`/users/${userId}/memberOf`).select("id,displayName,groupTypes").get();
                  IPC.log(`Found ${groups.value.length} groups.`);
                  let removedFromGroups = 0;
                  
                  for (const group of groups.value) {
                      try {
                          IPC.log(`Removing user from group ${group.displayName} (${group.id})...`);
                          await client.api(`/groups/${group.id}/members/${userId}/$ref`).delete();
                          removedFromGroups++;
                          actions.push({type: "SUCCESS", detail: `Removed from group: ${group.displayName}`});
                      } catch (grpErr: any) {
                          IPC.log(`Failed to remove from group ${group.id}: ${grpErr.message}`);
                      }
                  }
                  
                  if (removedFromGroups === 0) {
                      actions.push({type: "WARNING", detail: `Could not remove group-based licenses. User might be in Dynamic Groups or On-Prem Synced Groups.`});
                  }
              } else {
                  actions.push({type: "ERROR", detail: `License removal failed: ${e.message}`});
              }
          }
      }
    } else {
      actions.push({type: "INFO", detail: `No licenses found.`});
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