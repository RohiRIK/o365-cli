import { TaskRegistry } from "./handlers/registry";
import { GraphService } from "./services/graph";

// Import all task handlers (auto-register on import)
import "./handlers/iam/offboard";
import "./handlers/iam/guest-cleanup";
import "./handlers/sec/shadow-it";

const args = process.argv.slice(2);
const command = args[0];
const subArgs = args.slice(1);

async function main() {
  // Initialize token from stdin before any commands run
  await GraphService.initialize();

  // Execute task via registry (replaces hardcoded switch statement)
  await TaskRegistry.execute(command, subArgs);
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
