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
      // Usage: iam:offboard --user email@domain.com [--manager manager@domain.com] [--dry-run false]
      const userIndex = subArgs.indexOf("--user");
      if (userIndex === -1 || !subArgs[userIndex + 1]) {
        IPC.error("Missing required argument: --user <email>");
        return;
      }
      
      const managerIndex = subArgs.indexOf("--manager");
      const manager = managerIndex !== -1 ? subArgs[managerIndex + 1] : undefined;
      
      const deviceActionIndex = subArgs.indexOf("--device-action");
      const deviceAction = deviceActionIndex !== -1 ? subArgs[deviceActionIndex + 1] : "retire";
      
      const dryRunOffboardIndex = subArgs.indexOf("--dry-run");
      const dryRunVal = dryRunOffboardIndex !== -1 ? subArgs[dryRunOffboardIndex + 1] : "true";
      const dryRunOffboard = dryRunVal.trim().toLowerCase() !== "false";
      
      await offboardUser(subArgs[userIndex + 1], manager, dryRunOffboard, deviceAction);
      break;

    case "sec:shadow-it":
      // Usage: sec:shadow-it [--dry-run false]
      const dryRunIndex = subArgs.indexOf("--dry-run");
      const dryRunValSec = dryRunIndex !== -1 ? subArgs[dryRunIndex + 1] : "true";
      const dryRun = dryRunValSec.trim().toLowerCase() !== "false";
      
      await analyzeShadowIT(dryRun);
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
