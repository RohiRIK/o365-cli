import { glob } from "glob";
import path from "path";
import { TaskRegistry } from "./handlers/registry";

export async function loadCommands(directory: string = "./handlers") {
  // Use glob to find all files in the handlers directory
  // We exclude registry.ts and other non-handler files if necessary
  // But based on current structure, handlers are in subdirectories
  const pattern = path.join(directory, "**/*.{ts,js}");
  
  // Note: glob might return paths relative to CWD or absolute. 
  // We'll handle both.
  const files = await glob(pattern, { cwd: __dirname, absolute: true });

  for (const file of files) {
    // Skip registry.ts and test files
    if (file.endsWith("registry.ts") || file.endsWith(".test.ts")) {
      continue;
    }

    try {
      // Dynamic import
      await import(file);
    } catch (error) {
      console.warn(`Failed to load handler from ${file}:`, error);
    }
  }
  
  return TaskRegistry.getRegisteredTasks();
}
