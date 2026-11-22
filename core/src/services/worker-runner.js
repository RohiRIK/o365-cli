import { TaskRegistry } from "../handlers/registry";
import path from "path";
export class WorkerRunner {
    /**
     * Run a task in the current process using the TaskRegistry.
     * This is the simplest way since we are already in Bun.
     */
    async runTaskInProcess(taskId, args) {
        try {
            await TaskRegistry.execute(taskId, args);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * Run a task in a separate Bun process.
     * This provides isolation and matches the previous architecture's safety.
     */
    async runTaskInWorker(taskId, args, token) {
        const entryPoint = path.join(__dirname, "..", "index.ts");
        const cmd = ["bun", entryPoint, "run", taskId, ...args];
        // Pass token via environment variable or stdin
        const env = { ...process.env };
        if (token) {
            env.M365_ACCESS_TOKEN = token;
        }
        const proc = Bun.spawn(cmd, {
            env,
            stdout: "inherit", // For now, let it pipe to main stdout
            stderr: "inherit",
        });
        const exitCode = await proc.exited;
        return {
            success: exitCode === 0,
            error: exitCode !== 0 ? `Process exited with code ${exitCode}` : undefined
        };
    }
}
