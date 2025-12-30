import { Command } from "commander";
import { loadCommands } from "./loader";
import { TaskRegistry } from "./handlers/registry";
import { formatTable, printError, printInfo, printSuccess } from "./utils/output";
import path from "path";
import chalk from "chalk";

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
      printInfo(`Executing ${chalk.yellow(moduleName)}...`);
      
      // We'll capture the task output. 
      // For now, we'll let it print directly, but in a real implementation
      // we'd intercept IPC messages to show spinners and tables.
      try {
        await TaskRegistry.execute(moduleName, args);
      } catch (error: any) {
        printError(error.message);
      }
    });
    
  program
    .command("list")
    .description("List available modules")
    .action(() => {
        const tasks = TaskRegistry.getRegisteredTasks();
        console.log(chalk.cyan.bold("\nAvailable Modules:"));
        
        // Group by category (prefix before :)
        const categories: Record<string, string[]> = {};
        tasks.forEach(task => {
            const [cat] = task.split(":");
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(task);
        });

        for (const [cat, modules] of Object.entries(categories)) {
            console.log(chalk.yellow(`\n[${cat.toUpperCase()}]`));
            modules.forEach(m => console.log(`  - ${m}`));
        }
        console.log("");
    });
}

// Only run if called directly
if (import.meta.main) {
  const program = new Command();
  setupCLI(program).then(() => {
     program.parse(process.argv);
  });
}
