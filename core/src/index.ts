import { offboardUser } from "./commands/iam/offboard";
import { analyzeShadowIT } from "./commands/sec/shadow-it"; // Import the new command
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
      
      const dryRunOffboardIndex = subArgs.indexOf("--dry-run");
      const dryRunOffboard = dryRunOffboardIndex === -1 ? true : subArgs[dryRunOffboardIndex + 1] !== "false";
      
      await offboardUser(subArgs[userIndex + 1], manager, dryRunOffboard);
      break;

    case "sec:shadow-it":
      // Usage: sec:shadow-it [--dry-run false]
      const dryRunIndex = subArgs.indexOf("--dry-run");
      const dryRun = dryRunIndex === -1 ? true : subArgs[dryRunIndex + 1] !== "false";
      await analyzeShadowIT(dryRun);
      break;

    default:
      IPC.error(`Unknown command: ${command}`);
  }
}

main().catch(err => IPC.error(err.message));