import { Command } from "commander";
import { loadCommands } from "./loader";
import { TaskRegistry } from "./handlers/registry";
import { formatTable, printError, printInfo, printSuccess } from "./utils/output";
import { AuthService } from "./services/auth";
import { TokenStorage } from "./services/token-storage";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";

const tokenStorage = new TokenStorage("o365-cli");

async function ensureAuthenticated(tenantId: string = "common"): Promise<string> {
    const account = `user@${tenantId}`;
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

async function showInteractiveMenu() {
    console.log(chalk.cyan.bold("\n🚀 O365 CLI - Orchestration Menu"));
    
    const { action } = await inquirer.prompt([
        {
            type: "list",
            name: "action",
            message: "What would you like to do?",
            choices: [
                { name: "📋 List Modules", value: "list" },
                { name: "⚡ Run a Module", value: "run" },
                { name: "🔐 Login / Switch Tenant", value: "login" },
                { name: "🔍 Check Session Status", value: "status" },
                { name: "🚪 Exit", value: "exit" }
            ]
        }
    ]);

    switch (action) {
        case "list":
            const tasks = TaskRegistry.getRegisteredTasks();
            console.log(chalk.cyan.bold("\nAvailable Modules:"));
            tasks.forEach(t => console.log(` - ${t}`));
            await showInteractiveMenu();
            break;
        case "run":
            const { taskId } = await inquirer.prompt([
                {
                    type: "list",
                    name: "taskId",
                    message: "Select a module to run:",
                    choices: TaskRegistry.getRegisteredTasks()
                }
            ]);
            // For now, run with default dry-run
            await runTask(taskId, ["--dry-run", "true"]);
            await showInteractiveMenu();
            break;
        case "login":
            const { tenant } = await inquirer.prompt([{ name: "tenant", message: "Enter Tenant ID:", default: "common" }]);
            await ensureAuthenticated(tenant);
            await showInteractiveMenu();
            break;
        case "status":
            await showStatus();
            await showInteractiveMenu();
            break;
        case "exit":
            process.exit(0);
    }
}

async function showStatus() {
    // This is a simple implementation. In a real scenario, we'd decode the JWT to show the user name.
    printInfo("Checking active sessions...");
    // For now, just check if we have a common token
    const token = await tokenStorage.getToken("user@common");
    if (token) {
        printSuccess(`Session Active for tenant: ${chalk.yellow("common")}`);
    } else {
        printInfo("No active sessions found. Run 'login' to connect.");
    }
}

async function runTask(moduleName: string, args: string[]) {
    try {
        const token = await ensureAuthenticated("common"); // Default to common for interactive
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
      await runTask(moduleName, args);
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
    .command("status")
    .description("Show current authentication status")
    .action(async () => {
        await showStatus();
    });
    
  program
    .command("list")
    .description("List available modules")
    .action(() => {
        const tasks = TaskRegistry.getRegisteredTasks();
        console.log(chalk.cyan.bold("\nAvailable Modules:"));
        
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
     if (process.argv.length <= 2) {
         showInteractiveMenu();
     } else {
         program.parse(process.argv);
     }
  });
}

// Only run if called directly
if (import.meta.main) {
  const program = new Command();
  setupCLI(program).then(() => {
     program.parse(process.argv);
  });
}
