import { Command } from "commander";
import { loadCommands } from "./loader";
import { TaskRegistry } from "./handlers/registry";
import { formatTable, printError, printInfo, printSuccess } from "./utils/output";
import { AuthService } from "./services/auth";
import { TokenStorage } from "./services/token-storage";
import { GraphService } from "./services/graph";
import path from "path";
import chalk from "chalk";
import ora from "ora";

const tokenStorage = new TokenStorage("o365-cli");

async function ensureAuthenticated(tenantId: string = "common"): Promise<string> {
    const account = `user@${tenantId}`; // Simple account naming
    let token = await tokenStorage.getToken(account);

    if (!token) {
        printInfo("No active session found. Initializing login...");
        const authService = new AuthService(tenantId);
        const { accessToken, refreshToken } = await authService.login();
        
        await tokenStorage.saveToken(account, accessToken);
        if (refreshToken) {
            await tokenStorage.saveToken(`${account}:refresh`, refreshToken);
        }
        token = accessToken;
        printSuccess("Authentication successful!");
    }

    return token;
}

export async function setupCLI(program: Command) {
  program
    .version("0.0.1")
    .description("O365 CLI - TypeScript Orchestration");

  program
    .option("-t, --tenant <tenantId>", "Microsoft 365 Tenant ID or domain", "common");

  // Load all commands before running
  await loadCommands(path.join(__dirname, "handlers"));

  program
    .command("run <moduleName> [args...]")
    .description("Run a specific task module")
    .action(async (moduleName, args) => {
      const options = program.opts();
      
      try {
        const token = await ensureAuthenticated(options.tenant);
        
        // Initialize GraphService with the token
        process.env.GRAPH_TOKEN = token;
        
        const spinner = ora(`Executing ${chalk.yellow(moduleName)}...`).start();
        
        try {
          await TaskRegistry.execute(moduleName, args);
          spinner.succeed(chalk.green(`Task ${moduleName} completed.`));
        } catch (error: any) {
          spinner.fail(chalk.red(`Task ${moduleName} failed.`));
          printError(error.message);
        }
      } catch (error: any) {
        printError(`Authentication failed: ${error.message}`);
      }
    });

  program
    .command("login")
    .description("Authenticate with Microsoft 365")
    .action(async () => {
        const options = program.opts();
        try {
            await ensureAuthenticated(options.tenant);
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
