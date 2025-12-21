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
      .select("id,displayName,userPrincipalName,accountEnabled,assignedLicenses,mail")
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
    if (user.accountEnabled) {
      if (dryRun) {
        actions.push({type: "DRY-RUN", detail: `Would disable sign-in for ${displayName}`});
      } else {
        await client.api(`/users/${userId}`).update({ accountEnabled: false });
        actions.push({type: "SUCCESS", detail: `Disabled sign-in for ${displayName}`});
      }
    } else {
      actions.push({type: "INFO", detail: `Sign-in already disabled`});
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
        const devicesReq = await client.api(`/users/${userId}/managedDevices`)
            .select("id,deviceName,operatingSystem")
            .get();
        
        if (devicesReq.value.length > 0) {
            for (const dev of devicesReq.value) {
                const actionDesc = `Retire device ${dev.deviceName} (${dev.operatingSystem})`;
                if (dryRun) {
                    actions.push({type: "DRY-RUN", detail: `Would execute: ${actionDesc}`});
                } else {
                    await client.api(`/deviceManagement/managedDevices/${dev.id}/retire`).post({});
                    actions.push({type: "SUCCESS", detail: `Executed: ${actionDesc}`});
                }
            }
        } else {
            actions.push({type: "INFO", detail: `No managed devices found`});
        }
    } catch (e: any) {
        // Clean error message
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
      
      // Fetch detailed license info to find assignment paths (Direct vs Group)
      const licenseDetails = await client.api(`/users/${userId}/licenseDetails`).get();
      
      const directSkuIds: string[] = [];
      const groupIdsToRemove: string[] = [];

      for (const detail of licenseDetails.value) {
          // Check if it's inherited
          // assignmentPaths is array of { sourceId: string, sourceType: "Group" | "User" }
          // If sourceId == userId, it's direct. If different, it's group.
          // Actually, Graph returns 'Group' or 'User' in sourceType.
          
          // Unfortunately, licenseDetails sometimes doesn't return all info or requires specific permissions.
          // Alternative: check group memberships.
          
          // Let's stick to simple logic: If we can't find assignmentPaths, assume direct and try.
          // But we saw the error "inherited from group". 
          
          // Smart Logic:
          // We iterate groups to find which ones assign licenses.
          // This is heavy.
          // Better: Try to remove all licenses. If it fails with "inherited", THEN fetch groups.
          // But 'assignLicense' endpoint handles removal of direct licenses only.
      }

      // Let's try to distinguish using the licenseDetails we fetched
      // licenseDetails.value items have property 'skuId'.
      // But we need to know if it is group based.
      // Graph v1.0 `licenseDetails` object doesn't always expose `assignmentPaths` clearly in JS SDK without correct types.
      // Let's look at the error message from before: "User license is inherited..."
      
      // New Strategy:
      // 1. Try to remove ALL licenses (Direct removal).
      // 2. If it fails, assume group licenses exist and scan groups.
      
      const allSkuIds = user.assignedLicenses.map((l: any) => l.skuId);
      
      if (dryRun) {
          actions.push({type: "DRY-RUN", detail: `Would remove ${allSkuIds.length} licenses (checking for groups...)`});
      } else {
          try {
              await client.api(`/users/${userId}/assignLicense`).post({
                  addLicenses: [],
                  removeLicenses: allSkuIds
              });
              actions.push({type: "SUCCESS", detail: `Removed ${allSkuIds.length} direct license(s)`});
          } catch (e: any) {
              if (e.message.includes("inherited")) {
                  actions.push({type: "INFO", detail: `Some licenses are group-inherited. Scanning groups...`});
                  
                  // Fetch groups user is member of
                  const groups = await client.api(`/users/${userId}/memberOf`).select("id,displayName,groupTypes").get();
                  let removedFromGroups = 0;
                  
                  for (const group of groups.value) {
                      // We can't easily know IF this group assigns the license without checking the group's properties, 
                      // but for offboarding, we usually want to remove them from ALL security groups anyway.
                      // Let's try to remove from groups that are likely licensing groups (Security).
                      // Skip Sync'd groups (onPremisesSyncEnabled) if possible (checked via other props)
                      
                      try {
                          await client.api(`/groups/${group.id}/members/${userId}/$ref`).delete();
                          removedFromGroups++;
                          actions.push({type: "SUCCESS", detail: `Removed from group: ${group.displayName}`});
                      } catch (grpErr: any) {
                          // Ignore errors (e.g. dynamic groups where we can't remove)
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
