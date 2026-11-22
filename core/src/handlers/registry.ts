import { IPC } from "../utils/ipc";

/**
 * Task execution arguments parsed from command-line flags
 */
export interface TaskArgs {
  dryRun: boolean;
  [key: string]: any;
}

/**
 * Result of argument validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Task handler interface that all modules must implement
 * This replaces the hardcoded switch statement in index.ts
 */
export interface TaskHandler {
  /** Unique task identifier matching modules.toml (e.g., "iam:offboard") */
  taskId: string;

  /** Human-readable name for the task */
  name: string;

  /** Short description of what the task does */
  description: string;

  /** Task type: 'audit' for read-only reports, 'action' for mutating operations */
  type: "audit" | "action";

  /** Readiness status: 'prod', 'beta', or 'draft' */
  status: "prod" | "beta" | "draft";

  /** Execute the task with parsed arguments */
  execute(args: TaskArgs): Promise<void>;

  /** Parse raw CLI arguments into structured TaskArgs */
  parseArgs(rawArgs: string[]): TaskArgs;

  /** Validate parsed arguments before execution */
  validate(args: TaskArgs): ValidationResult;
}

/**
 * Global task registry for dynamic module routing
 * Replaces hardcoded switch statements with trait-based extensibility
 */
export class TaskRegistry {
  private static handlers = new Map<string, TaskHandler>();

  /**
   * Register a task handler
   * Called automatically by modules during import
   */
  static register(handler: TaskHandler): void {
    if (this.handlers.has(handler.taskId)) {
      console.warn(`TaskRegistry: Overwriting existing handler for ${handler.taskId}`);
    }
    this.handlers.set(handler.taskId, handler);
  }

  /**
   * Get a registered task handler by ID
   */
  static getHandler(taskId: string): TaskHandler | undefined {
    return this.handlers.get(taskId);
  }

  /**
   * Execute a registered task by ID
   * @param taskId - Task identifier (e.g., "iam:offboard")
   * @param rawArgs - Raw CLI arguments from process.argv
   */
  static async execute(taskId: string, rawArgs: string[]): Promise<void> {
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
    } catch (error: any) {
      IPC.error(`Task execution failed: ${error.message}`);
    }
  }

  /**
   * Get all registered task IDs
   * Useful for debugging and validation
   */
  static getRegisteredTasks(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a task is registered
   */
  static isRegistered(taskId: string): boolean {
    return this.handlers.has(taskId);
  }

  /**
   * Clear all registered handlers (primarily for testing)
   */
  static clear(): void {
    this.handlers.clear();
  }
}

/**
 * Utility function to parse boolean flags from CLI arguments
 * @param args - Raw CLI arguments
 * @param flag - Flag name (e.g., "dry-run")
 * @param defaultValue - Default value if flag not present
 */
export function parseBooleanFlag(
  args: string[],
  flag: string,
  defaultValue: boolean = true
): boolean {
  const index = args.indexOf(`--${flag}`);
  if (index === -1) return defaultValue;

  const value = args[index + 1];
  if (!value) return defaultValue;

  return value.trim().toLowerCase() !== "false";
}

/**
 * Utility function to parse string flags from CLI arguments
 * @param args - Raw CLI arguments
 * @param flag - Flag name (e.g., "user")
 * @param required - Whether the flag is required
 */
export function parseStringFlag(
  args: string[],
  flag: string,
  required: boolean = false
): string | undefined {
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
export function parseNumberFlag(
  args: string[],
  flag: string,
  defaultValue?: number
): number | undefined {
  const index = args.indexOf(`--${flag}`);
  if (index === -1) return defaultValue;

  const value = args[index + 1];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for flag --${flag}: ${value}`);
  }

  return parsed;
}
