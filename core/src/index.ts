import { offboardUser } from "./commands/iam/offboard";
import { analyzeShadowIT } from "./commands/sec/shadow-it";
import { cleanupGuests } from "./commands/iam/guest-cleanup";
import { IPC } from "./utils/ipc";
import { GraphService } from "./services/graph";

const args = process.argv.slice(2);
const command = args[0];
const subArgs = args.slice(1);

async function main() {
  // Initialize token from stdin before any commands run
  await GraphService.initialize();
  
  switch (command) {
    case "iam:offboard":
      // ... (existing code)
      break;

    case "sec:shadow-it":
      // ... (existing code)
      break;

    case "iam:guest-cleanup":
      // Usage: iam:guest-cleanup [--days 90] [--dry-run false]
      const daysIndex = subArgs.indexOf("--days");
      const days = daysIndex !== -1 ? parseInt(subArgs[daysIndex + 1]) : 90;
      
      const dryRunGuestIndex = subArgs.indexOf("--dry-run");
      const dryRunGuestVal = dryRunGuestIndex !== -1 ? subArgs[dryRunGuestIndex + 1] : "true";
      const dryRunGuest = dryRunGuestVal.trim().toLowerCase() !== "false";
      
      await cleanupGuests(days, dryRunGuest);
      break;

    default:
      IPC.error(`Unknown command: ${command}`);
  }
}

main().catch(err => IPC.error(err.message));