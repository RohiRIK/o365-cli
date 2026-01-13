import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

/**
 * Surgical Lockdown - Emergency Account Lockdown
 * CRITICAL: Must complete in <60s for incident response
 *
 * Actions performed:
 * 1. Disable user account
 * 2. Revoke all active sessions
 * 3. Wipe/retire all managed devices
 * 4. Block incoming mail (optional - requires Exchange admin)
 * 5. Log all actions with timestamps
 *
 * This is an irreversible emergency response action - use with caution!
 */
export async function executeSurgicalLockdown(userEmail: string) {
  const client = GraphService.getClient();
  const startTime = Date.now();

  IPC.progress("EMERGENCY: Starting surgical lockdown...", 0);
  IPC.log(`Target: ${userEmail}`, "error");
  IPC.log("This will disable the account, revoke sessions, and wipe devices!", "error");

  try {
    // Step 1: Find user by email
    IPC.progress("Locating user account...", 10);
    const users = await GraphService.fetchAll(
      `/users?$filter=userPrincipalName eq '${userEmail}'`,
      "id,userPrincipalName,displayName,accountEnabled"
    );

    if (users.length === 0) {
      IPC.error(`User not found: ${userEmail}`);
      return;
    }

    const user = users[0];
    IPC.log(`Found: ${user.displayName} (${user.userPrincipalName})`, "info");

    if (user.accountEnabled === false) {
      IPC.log("Account is already disabled", "warn");
    }

    const userId = user.id;
    const actions: Array<{ action: string; timestamp: string; status: string }> = [];

    // Step 2: Disable account
    IPC.progress("Disabling account...", 20);
    try {
      await client.api(`/users/${userId}`).patch({
        accountEnabled: false,
      });
      const timestamp = new Date().toISOString();
      actions.push({
        action: "Disable Account",
        timestamp,
        status: "✓ Success",
      });
      IPC.log("Account disabled", "info");
    } catch (error: any) {
      actions.push({
        action: "Disable Account",
        timestamp: new Date().toISOString(),
        status: `✗ Failed: ${error.message}`,
      });
    }

    // Step 3: Revoke all sessions
    IPC.progress("Revoking all sessions...", 40);
    try {
      await client.api(`/users/${userId}/revokeSignInSessions`).post({});
      const timestamp = new Date().toISOString();
      actions.push({
        action: "Revoke All Sessions",
        timestamp,
        status: "✓ Success",
      });
      IPC.log("All sessions revoked", "info");
    } catch (error: any) {
      actions.push({
        action: "Revoke All Sessions",
        timestamp: new Date().toISOString(),
        status: `✗ Failed: ${error.message}`,
      });
    }

    // Step 4: Get and wipe all managed devices
    IPC.progress("Identifying managed devices...", 60);
    try {
      const devices = await GraphService.fetchAll(
        `/users/${userId}/managedDevices`,
        "id,deviceName,operatingSystem"
      );

      IPC.log(`Found ${devices.length} managed devices`, "info");

      if (devices.length > 0) {
        IPC.progress("Wiping/retiring devices...", 70);

        for (const device of devices) {
          try {
            // Use retire for graceful removal (preserves company data)
            // Use wipe for complete data erasure (more aggressive)
            await client.api(`/deviceManagement/managedDevices/${device.id}/retire`).post({});

            actions.push({
              action: `Retire Device: ${device.deviceName} (${device.operatingSystem})`,
              timestamp: new Date().toISOString(),
              status: "✓ Success",
            });
            IPC.log(`Retired: ${device.deviceName}`, "info");
          } catch (error: any) {
            actions.push({
              action: `Retire Device: ${device.deviceName}`,
              timestamp: new Date().toISOString(),
              status: `✗ Failed: ${error.message}`,
            });
          }
        }
      } else {
        actions.push({
          action: "Wipe Devices",
          timestamp: new Date().toISOString(),
          status: "⊘ No devices found",
        });
      }
    } catch (error: any) {
      actions.push({
        action: "Wipe Devices",
        timestamp: new Date().toISOString(),
        status: `✗ Failed: ${error.message}`,
      });
    }

    // Step 5: Block incoming mail (optional - requires mailbox settings API)
    IPC.progress("Blocking incoming mail...", 90);
    try {
      // Note: This requires Exchange admin permissions
      // Create an inbox rule to delete all incoming mail
      await client.api(`/users/${userId}/mailFolders/inbox/messageRules`).post({
        displayName: "EMERGENCY LOCKDOWN - Block All Mail",
        sequence: 1,
        isEnabled: true,
        conditions: {
          // Match all messages
        },
        actions: {
          delete: true,
          stopProcessingRules: true,
        },
      });

      actions.push({
        action: "Block Incoming Mail",
        timestamp: new Date().toISOString(),
        status: "✓ Success",
      });
      IPC.log("Incoming mail blocked", "info");
    } catch (error: any) {
      // This may fail if Exchange permissions are insufficient - not critical
      actions.push({
        action: "Block Incoming Mail",
        timestamp: new Date().toISOString(),
        status: `⚠ Skipped: ${error.message}`,
      });
      IPC.log("Could not block mail (may require additional permissions)", "warn");
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    IPC.success({
      message: `Surgical Lockdown Complete - ${user.displayName} (${duration}s)`,
      table: {
        headers: ["Action", "Timestamp", "Status"],
        rows: actions.map(a => [a.action, a.timestamp.split('T')[1].split('.')[0], a.status]),
      },
    });

    IPC.log(`Total duration: ${duration} seconds`, duration < 60 ? "info" : "warn");

    if (parseFloat(duration) >= 60) {
      IPC.log("WARNING: Lockdown took longer than 60s - review performance", "warn");
    }

    IPC.log("Next steps:", "info");
    IPC.log("1. Verify all sessions are terminated", "info");
    IPC.log("2. Review audit logs for suspicious activity", "info");
    IPC.log("3. Investigate incident root cause", "info");
    IPC.log("4. Document actions taken for compliance", "info");

  } catch (error: any) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    IPC.error(`Surgical lockdown failed after ${duration}s: ${error.message}`);
  }
}
