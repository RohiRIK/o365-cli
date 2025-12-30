import { Command } from "commander";

export function setupCLI(program: Command) {
  program
    .version("0.0.1")
    .description("O365 CLI - TypeScript Orchestration");

  program
    .command("run <moduleName> [args...]")
    .description("Run a specific task module")
    .action((moduleName, args) => {
      console.log(`Running module: ${moduleName} with args: ${args}`);
      // Implementation will be added in future tasks
    });
}

// Only run if called directly
if (import.meta.main) {
  const program = new Command();
  setupCLI(program);
  program.parse(process.argv);
}
