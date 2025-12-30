import { Command } from "commander";
import { loadCommands } from "./loader";
import { TaskRegistry } from "./handlers/registry";
import path from "path";

export async function setupCLI(program: Command) {
  program
    .version("0.0.1")
    .description("O365 CLI - TypeScript Orchestration");

  // Load all commands before running
  await loadCommands(path.join(__dirname, "handlers"));

  program
    .command("run <moduleName> [args...]")
    .description("Run a specific task module")
    .action(async (moduleName, args) => {
      console.log(`Running module: ${moduleName} with args: ${args}`);
      await TaskRegistry.execute(moduleName, args);
    });
    
  program
    .command("list")
    .description("List available modules")
    .action(() => {
        const tasks = TaskRegistry.getRegisteredTasks();
        console.log("Available Modules:");
        tasks.forEach(t => console.log(` - ${t}`));
    });
}

// Only run if called directly
if (import.meta.main) {
  const program = new Command();
  setupCLI(program).then(() => {
     program.parse(process.argv);
  });
}
