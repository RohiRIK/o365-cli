import { theme } from "./theme";
/**
 * Terminal cursor management
 */
export const cursor = {
    show: () => process.stdout.write("\u001B[?25h"),
    hide: () => process.stdout.write("\u001B[?25l"),
};
/**
 * Set up global signal handlers for graceful shutdown
 */
export function setupSignalHandlers() {
    process.on("SIGINT", () => {
        cursor.show();
        console.log("\n" + theme.primary("🚪 Execution interrupted. Exiting..."));
        process.exit(0);
    });
    process.on("SIGTERM", () => {
        cursor.show();
        process.exit(0);
    });
    // Ensure cursor is shown on exit
    process.on("exit", () => {
        cursor.show();
    });
}
