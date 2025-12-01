import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

export async function offboardUser(email: string) {
  IPC.progress(`Initializing offboarding for ${email}...`, 0);
  const client = GraphService.getClient();

  try {
    IPC.progress("Searching for user in Entra ID...", 10);
    const user = await client.api(`/users/${email}`).get();

    if (!user) {
      IPC.error(`User ${email} not found.`);
      return;
    }

    IPC.progress("User found. Preparing resources...", 20);
    
    // Placeholder for future logic (license stripping, mailbox conversion)

    IPC.success({
      action: "Offboard Initialization",
      target: user.displayName,
      id: user.id,
      status: "Found - Ready for processing"
    });

  } catch (error: any) {
    IPC.error(error.message || "Unknown Graph API error");
  }
}
