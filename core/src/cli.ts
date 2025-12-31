import { Command } from "commander";
import { loadCommands } from "./loader";
import { TaskRegistry } from "./handlers/registry";
import { printError, printInfo, printSuccess } from "./utils/output";
import { AuthService } from "./services/auth";
import { TokenStorage } from "./services/token-storage";
import { getCategoryChoices, getModulesInCategory, CATEGORY_MAP } from "./utils/menu";
import { select, input, Separator, confirm } from "@inquirer/prompts";
import { jwtDecode } from "jwt-decode";
import { IPC } from "./utils/ipc";
import { setupSignalHandlers } from "./utils/process";
import * as fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";

setupSignalHandlers();

const tokenStorage = new TokenStorage("o365-cli");

interface DecodedToken {
    name?: string;
    upn?: string;
    unique_name?: string;
    tid?: string;
    exp?: number;
    iat?: number;
    scp?: string;
}

// Minimalist theme with no help text
const CUSTOM_THEME = {
    helpMode: 'never' as const,
    style: {
        message: (text: string) => chalk.bold.cyan(text),
    }
};

// Global cache for org name to avoid redundant API calls
let cachedOrgName: string | null = null;

async function getSessionDetails(tenantId: string = "common", includeOrg: boolean = true) {
    const token = await tokenStorage.getToken(`user@${tenantId}`);
    if (!token) return null;

    try {
        const decoded = jwtDecode<DecodedToken>(token);
        const details: any = {
            user: decoded.name || decoded.upn || decoded.unique_name || "Unknown User",
            email: decoded.upn || decoded.unique_name || "N/A",
            tenant: decoded.tid || tenantId,
            expires: decoded.exp ? new Date(decoded.exp * 1000) : null,
            issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : null,
            scopes: decoded.scp?.split(" ") || []
        };

        if (includeOrg) {
            details.orgName = await getOrganizationName();
        }

        return details;
    } catch {
        return null;
    }
}

function getStatusPrefix(session: any) {
    if (!session) return chalk.gray("○ Not Authenticated › ");
    return chalk.gray(`● Logged in as ${session.user} › `);
}

async function ensureAuthenticated(tenantId: string = "common"): Promise<string> {
    const account = `user@${tenantId}`;
    let token = await tokenStorage.getToken(account);

    if (!token) {
        printInfo(`No active session found. Initializing login...`);
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

async function handleLoginMenu() {
    const session = await getSessionDetails("common");
    console.clear();
    
    if (session) {
        console.log(chalk.cyan.bold("\n👤 Current Session Details:"));
        console.log(`  ${chalk.bold("Organization:")} ${chalk.yellow(session.orgName || "N/A")}`);
        console.log(`  ${chalk.bold("User:")}         ${session.user}`);
        console.log(`  ${chalk.bold("Email:")}        ${session.email}`);
        console.log(`  ${chalk.bold("Tenant:")}       ${session.tenant}`);
        if (session.issuedAt) console.log(`  ${chalk.bold("Issued At:")}     ${session.issuedAt.toLocaleString()}`);
        if (session.expires) {
            const isExpired = session.expires < new Date();
            const color = isExpired ? chalk.red : chalk.green;
            console.log(`  ${chalk.bold("Expires At:")}    ${color(session.expires.toLocaleString())}`);
            console.log(`  ${chalk.bold("Status:")}        ${color(isExpired ? "Expired" : "Active")}`);
        }
        console.log(`  ${chalk.bold("Scopes:")}        ${chalk.dim(session.scopes.join(", "))}`);
        console.log("");

        const choice = await select({
            message: "Account Management:",
            choices: [
                { name: "🔄 Refresh Session", value: "refresh" },
                { name: "🔑 Switch Tenant / New Login", value: "switch" },
                { name: "🗑️ Logout (Clear Cache)", value: "logout" },
                { name: "🔙 Back to Menu", value: "back" }
            ],
            theme: CUSTOM_THEME
        });

        if (choice === "refresh") {
            await tokenStorage.deleteToken("user@common");
            await ensureAuthenticated("common");
        } else if (choice === "switch") {
            const tenant = await input({ message: "Enter Tenant ID or domain:", default: "common" });
            await ensureAuthenticated(tenant);
        } else if (choice === "logout") {
            await tokenStorage.deleteToken("user@common");
            await tokenStorage.deleteToken("user@common:refresh");
            cachedOrgName = null; // Clear org name cache
            printSuccess("Logged out successfully.");
        }
    } else {
        printInfo("No active session found.");
        const start = await select({
            message: "What would you like to do?",
            choices: [
                { name: "🔐 Login to Microsoft 365", value: "login" },
                { name: "🔙 Back to Menu", value: "back" }
            ],
            theme: CUSTOM_THEME
        });
        if (start === "login") {
            const tenant = await input({ message: "Enter Tenant ID:", default: "common" });
            await ensureAuthenticated(tenant);
        }
    }
}

import { select, input, Separator, confirm } from "@inquirer/prompts";

/**
 * Intelligent Module Selector with Drill-Down (Tasks only)
 */
async function runModuleSelector(isMainMenu: boolean = false, showAll: boolean = false): Promise<string | "exit"> {
    const taskIds = TaskRegistry.getRegisteredTasks();
    const session = await getSessionDetails("common");
    const prefix = getStatusPrefix(session);
    
    try {
        const categories = getCategoryChoices(taskIds, showAll);
        
        if (categories.length === 0) {
            printInfo("\nNo production modules available yet. Run with 'dev' to see draft modules.");
            await input({ message: "Press Enter to return..." });
            return "exit";
        }

        // Step 1: Select Category
        const category = await select({
            message: `Select a Task Category ${showAll ? chalk.yellow("[DEV MODE]") : ""}:`,
            prefix,
            choices: [
                ...categories,
                new Separator(chalk.dim("──────────────────────────────")),
                { name: "⚙️  System Settings", value: "sys:settings" },
                { name: isMainMenu ? "🔙 Back to Main Menu" : "⎋  Cancel / Exit", value: "exit" }
            ],
            pageSize: 15,
            theme: CUSTOM_THEME
        });

        if (category === "exit") return "exit";
        if (category === "sys:settings") {
            await handleLoginMenu();
            return await runModuleSelector(isMainMenu, showAll);
        }

        // Step 2: Select Module in Category
        const moduleId = await select({
            message: `Modules in ${CATEGORY_MAP[category]?.name || category}:`,
            prefix,
            choices: [
                ...getModulesInCategory(taskIds, category, showAll),
                new Separator(chalk.dim("──────────────────────────────")),
                { name: "🔙 Back to Categories", value: "retry" }
            ],
            pageSize: 15,
            theme: CUSTOM_THEME
        });

        if (moduleId === "retry") return await runModuleSelector(isMainMenu, showAll);
        return moduleId;
    } catch (e: any) {
        return "exit";
    }
}

async function showInteractiveMenu(showAll: boolean = false) {
    console.clear();
    const session = await getSessionDetails("common");
    const prefix = getStatusPrefix(session);
    
    console.log(chalk.cyan.bold("\n-------------------------------------------"));
    console.log(chalk.cyan.bold(`🚀 O365 CLI - ${showAll ? "Developer Console" : "Production Orchestrator"}`));
    console.log(chalk.cyan.bold("-------------------------------------------"));
    
    try {
        const action = await select({
            message: "Control Center:",
            prefix,
            choices: [
                new Separator(chalk.yellow("─── TASKS ───")),
                { name: "⚡ Run a Module", value: "run" },
                { name: "📋 List Available Modules", value: "list" },
                new Separator(chalk.yellow("─── SYSTEM ───")),
                { name: "⚙️  Settings & Accounts", value: "settings" },
                new Separator(chalk.dim("──────────────────────────────")),
                { name: "🚪 Exit", value: "exit" }
            ],
            theme: CUSTOM_THEME
        });

        switch (action) {
            case "list": {
                const tasks = TaskRegistry.getRegisteredTasks();
                console.log(chalk.cyan.bold(`\n${showAll ? "All" : "Production"} Modules:`));
                const categories = getCategoryChoices(tasks, showAll);
                categories.forEach(cat => {
                    console.log(chalk.yellow(`\n${cat.name}`));
                    getModulesInCategory(tasks, cat.value, showAll).forEach(m => {
                        console.log(`  ${m.name}`);
                    });
                });
                console.log("");
                await input({ message: "Press Enter to continue..." });
                await showInteractiveMenu(showAll);
                break;
            }
            case "run": {
                const moduleId = await runModuleSelector(true, showAll);
                if (moduleId !== "exit") {
                    const handler = TaskRegistry.getHandler(moduleId);
                    const args = (handler?.type === "action") ? ["--dry-run", "true"] : [];
                    await runTask(moduleId, args);
                    await input({ message: "\nTask completed. Press Enter to return to menu..." });
                }
                // Recursively call to return to main menu
                await showInteractiveMenu(showAll);
                break;
            }
            case "settings": {
                await handleLoginMenu();
                await showInteractiveMenu(showAll);
                break;
            }
            case "exit": {
                process.exit(0);
            }
        }
    } catch (e: any) {
        process.exit(0);
    }
}

async function showStatus() {
    const session = await getSessionDetails("common");
    if (session) {
        printSuccess(`Session Active for ${chalk.yellow(session.email)}`);
        console.log(`  - Tenant:     ${session.tenant}`);
        if (session.issuedAt) console.log(`  - Issued At:  ${session.issuedAt.toLocaleString()}`);
        if (session.expires) {
            const isExpired = session.expires < new Date();
            const color = isExpired ? chalk.red : chalk.green;
            console.log(`  - Expires At: ${color(session.expires.toLocaleString())}`);
            console.log(`  - Status:     ${color(isExpired ? "Expired" : "Active")}`);
        }
        console.log(`  - Scopes:     ${chalk.dim(session.scopes.join(", "))}`);
    } else {
        printInfo("No active sessions found. Run 'login' to connect.");
    }
}

async function getOrganizationName(forFilename: boolean = false): Promise<string> {
    if (cachedOrgName && !forFilename) return cachedOrgName;
    
    const session = await getSessionDetails("common", false); 
    if (!session?.tenant) return "o365";

    let name = "o365";
    try {
        const org = await GraphService.get(`/organization/${session.tenant}`);
        if (org?.displayName) {
            name = org.displayName;
            cachedOrgName = name;
        }
    } catch {
        const domain = session.email?.split('@')[1]?.split('.')[0];
        if (domain) name = domain.toUpperCase();
    }

    if (forFilename) {
        return name.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
    }
    return name;
}

async function runTask(moduleName: string, args: string[]) {
    try {
        const token = await ensureAuthenticated("common");
        process.env.GRAPH_TOKEN = token;
        
        IPC.setMode('pretty');
        IPC.clearLastTable();

        console.log("");
        const spinner = ora(`Initializing ${chalk.yellow(moduleName)}...`).start();
        
        // Hook IPC progress to update the spinner text instead of printing new lines
        IPC.onProgress((message, percent) => {
            const p = percent !== undefined ? ` [${percent}%]` : '';
            spinner.text = `${chalk.yellow(moduleName)}: ${message}${p}`;
        });

        try {
            await TaskRegistry.execute(moduleName, args);
            spinner.succeed(chalk.green(`Task ${moduleName} completed.`));

            // Clean up the hook
            IPC.onProgress(() => {});

            // Post-Task Export Logic
            const lastTable = IPC.getLastTable();
            if (lastTable) {
                // Fetch real org name for filename (sanitized and lowercase)
                const orgSlug = await getOrganizationName(true);
                
                const shouldExport = await confirm({
                    message: "Would you like to export these results to a CSV file?",
                    default: false,
                    theme: CUSTOM_THEME
                });

                if (shouldExport) {
                    const cleanModuleName = moduleName.replace(':', '_');
                    const orgSlug = await getOrganizationName(true);
                    const defaultFilename = `${orgSlug}_${cleanModuleName}_results.csv`;
                    
                    // Ensure output directory exists
                    const outputDir = path.resolve(process.cwd(), "output");
                    if (!fs.existsSync(outputDir)) {
                        fs.mkdirSync(outputDir, { recursive: true });
                    }

                    const filename = await input({ message: "Enter filename:", default: defaultFilename });
                    const fullPath = path.resolve(outputDir, filename);
                    
                    const csv = [
                        lastTable.headers.join(","),
                        ...lastTable.rows.map(row => row.map(cell => `"${cell}"`).join(","))
                    ].join("\n");
                    
                    fs.writeFileSync(fullPath, csv);
                    printSuccess(`Results exported to ${chalk.yellow(fullPath)}`);
                }
            }
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
    .version("1.0.0")
    .description("O365 CLI - Unified TypeScript Orchestration");

  program
    .option("-t, --tenant <tenantId>", "Microsoft 365 Tenant ID or domain", "common");

  // Load handlers
  const handlersPath = path.resolve(__dirname, "handlers");
  await loadCommands(handlersPath);
  
  if (TaskRegistry.getRegisteredTasks().length === 0) {
      await loadCommands(path.resolve(process.cwd(), "src/handlers"));
  }

  program
    .command("run [moduleName] [args...]")
    .description("Run a module (interactive if name is omitted)")
    .action(async (moduleName, args) => {
      if (!moduleName) {
          const id = await runModuleSelector(false, false);
          if (id === "exit") return;
          moduleName = id;
      }
      await runTask(moduleName, args);
    });

  program
    .command("dev")
    .description("Launch interactive menu in Developer Mode (shows all modules)")
    .action(async () => {
        await showInteractiveMenu(true);
    });

  program
    .command("login [tenantId]")
    .description("Authenticate with Microsoft 365")
    .action(async (tenantId) => {
        const options = program.opts();
        if (!tenantId && process.argv.includes("login") && !process.argv.includes("-t")) {
            await handleLoginMenu();
        } else {
            const tenant = tenantId || options.tenant;
            try {
                await ensureAuthenticated(tenant);
            } catch (error: any) {
                printError(error.message);
            }
        }
    });

  program
    .command("status")
    .description("Show session status")
    .action(async () => {
        await showStatus();
    });
    
  program
    .command("list")
    .description("List modules")
    .action(() => {
        const tasks = TaskRegistry.getRegisteredTasks();
        const categories = getCategoryChoices(tasks);
        categories.forEach(cat => {
            console.log(chalk.yellow(`\n${cat.name}`));
            const modules = getModulesInCategory(tasks, cat.value);
            modules.forEach(m => {
                const handler = TaskRegistry.getHandler(m.value);
                const statusColor = handler?.status === "prod" ? chalk.green : (handler?.status === "beta" ? chalk.yellow : chalk.gray);
                const statusTag = `[${handler?.status?.toUpperCase() || "BETA"}]`;
                console.log(`  ${chalk.cyan("→")} ${m.value.padEnd(25)} ${statusColor(statusTag)}`);
            });
        });
        console.log("");
    });
}

if (import.meta.main) {
  const program = new Command();
  setupCLI(program).then(() => {
     const args = process.argv.slice(2);
     if (args.length === 0 || (args.length === 2 && (args[0] === "-t" || args[0] === "--tenant"))) {
         showInteractiveMenu();
     } else {
         program.parse(process.argv);
     }
  });
}
