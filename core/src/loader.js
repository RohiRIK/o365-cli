import { glob } from "glob";
import path from "path";
import { TaskRegistry } from "./handlers/registry";
/**
 * Dynamically loads all task handlers from the specified directory
 */
export async function loadCommands(directory = "./handlers") {
    const searchPath = directory.endsWith("/") ? directory : directory + "/";
    const pattern = `${searchPath}**/*.{ts,js}`;
    const files = await glob(pattern);
    for (const file of files) {
        // Skip registry, tests, and type definitions
        if (file.endsWith("registry.ts") || file.endsWith(".test.ts") || file.endsWith(".d.ts")) {
            continue;
        }
        try {
            // Dynamic import using absolute path
            const absolutePath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
            await import(absolutePath);
        }
        catch (error) {
            // Only log actual errors, not discovery info
            console.warn(`[Loader] Failed to load handler from ${file}:`, error.message);
        }
    }
    return TaskRegistry.getRegisteredTasks();
}
