import { IPC } from "../utils/ipc";
/**
 * Global task registry for dynamic module routing
 * Replaces hardcoded switch statements with trait-based extensibility
 */
export class TaskRegistry {
    static handlers = new Map();
    /**
     * Register a task handler
     * Called automatically by modules during import
     */
    static register(handler) {
        if (this.handlers.has(handler.taskId)) {
            console.warn(`TaskRegistry: Overwriting existing handler for ${handler.taskId}`);
        }
        this.handlers.set(handler.taskId, handler);
    }
    /**
     * Get a registered task handler by ID
     */
    static getHandler(taskId) {
        return this.handlers.get(taskId);
    }
    /**
     * Execute a registered task by ID
     * @param taskId - Task identifier (e.g., "iam:offboard")
     * @param rawArgs - Raw CLI arguments from process.argv
     */
    static async execute(taskId, rawArgs) {
        const handler = this.handlers.get(taskId);
        if (!handler) {
            const availableTasks = Array.from(this.handlers.keys()).join(", ");
            IPC.error(`Unknown task: ${taskId}. Available tasks: ${availableTasks}`);
            return;
        }
        try {
            // Parse arguments
            const args = handler.parseArgs(rawArgs);
            // Validate arguments
            const validation = handler.validate(args);
            if (!validation.valid) {
                IPC.error(`Invalid arguments: ${validation.error}`);
                return;
            }
            // Execute task
            await handler.execute(args);
        }
        catch (error) {
            IPC.error(`Task execution failed: ${error.message}`);
        }
    }
    /**
     * Get all registered task IDs
     * Useful for debugging and validation
     */
    static getRegisteredTasks() {
        return Array.from(this.handlers.keys());
    }
    /**
     * Check if a task is registered
     */
    static isRegistered(taskId) {
        return this.handlers.has(taskId);
    }
    /**
     * Clear all registered handlers (primarily for testing)
     */
    static clear() {
        this.handlers.clear();
    }
}
/**
 * Utility function to parse boolean flags from CLI arguments
 * @param args - Raw CLI arguments
 * @param flag - Flag name (e.g., "dry-run")
 * @param defaultValue - Default value if flag not present
 */
export function parseBooleanFlag(args, flag, defaultValue = true) {
    const index = args.indexOf(`--${flag}`);
    if (index === -1)
        return defaultValue;
    const value = args[index + 1];
    if (!value)
        return defaultValue;
    return value.trim().toLowerCase() !== "false";
}
/**
 * Utility function to parse string flags from CLI arguments
 * @param args - Raw CLI arguments
 * @param flag - Flag name (e.g., "user")
 * @param required - Whether the flag is required
 */
export function parseStringFlag(args, flag, required = false) {
    const index = args.indexOf(`--${flag}`);
    if (index === -1) {
        if (required) {
            throw new Error(`Missing required flag: --${flag}`);
        }
        return undefined;
    }
    const value = args[index + 1];
    if (!value && required) {
        throw new Error(`Missing value for flag: --${flag}`);
    }
    return value;
}
/**
 * Utility function to parse number flags from CLI arguments
 * @param args - Raw CLI arguments
 * @param flag - Flag name (e.g., "days")
 * @param defaultValue - Default value if flag not present
 */
export function parseNumberFlag(args, flag, defaultValue) {
    const index = args.indexOf(`--${flag}`);
    if (index === -1)
        return defaultValue;
    const value = args[index + 1];
    if (!value)
        return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Invalid number for flag --${flag}: ${value}`);
    }
    return parsed;
}
