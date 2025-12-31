import chalk from "chalk";
import { theme } from "./theme";
import { TaskRegistry } from "../handlers/registry";

/**
 * Category metadata for better display names and icons
 */
export const CATEGORY_MAP: Record<string, { name: string; icon: string }> = {
    iam: { name: "Identity & Access", icon: "👤" },
    sec: { name: "Security & Audit", icon: "🛡️" },
    res: { name: "Resource Management", icon: "📦" },
    dev: { name: "Device Management", icon: "💻" },
    gov: { name: "Governance & DLP", icon: "📜" },
    cost: { name: "Cost Optimization", icon: "💰" },
    collab: { name: "Collaboration", icon: "🤝" },
    rep: { name: "Reporting", icon: "📊" }
};

/**
 * Gets a list of unique categories from registered task IDs, optionally filtered by status
 */
export function getCategoryChoices(taskIds: string[], showAll: boolean = true) {
    const filteredIds = taskIds.filter(id => {
        if (showAll) return true;
        const handler = TaskRegistry.getHandler(id);
        return handler?.status === "prod";
    });

    const prefixes = new Set(filteredIds.map(id => id.split(":")[0]));
    return Array.from(prefixes).sort().map(prefix => {
        const meta = CATEGORY_MAP[prefix] || { name: prefix.toUpperCase(), icon: "⚙️" };
        return {
            name: `${meta.icon} ${meta.name}`,
            value: prefix
        };
    });
}

/**
 * Gets modules filtered by a specific category and optionally status
 */
export function getModulesInCategory(taskIds: string[], category: string, showAll: boolean = true) {
    if (category === "sys") {
        return [
            { name: `  ${theme.primary("→")} sys:settings`, value: "sys:settings", description: "Manage logins and accounts" },
            { name: `  ${theme.primary("→")} sys:status`, value: "sys:status", description: "View detailed session info" }
        ];
    }
    return taskIds
        .filter(id => id.startsWith(`${category}:`))
        .filter(id => {
            if (showAll) return true;
            const handler = TaskRegistry.getHandler(id);
            return handler?.status === "prod";
        })
        .sort()
        .map(id => {
            const handler = TaskRegistry.getHandler(id);
            const statusTag = showAll ? ` [${handler?.status?.toUpperCase()}]` : "";
            return {
                name: `  ${theme.primary("→")} ${handler?.name || id}${theme.dim(statusTag)}`,
                value: id,
                description: handler?.description || `Run module ${id}`
            };
        });
}

/**
 * Gets all module choices for searchable selection
 */
export function getAllModuleChoices(showAll: boolean = true) {
    const taskIds = TaskRegistry.getRegisteredTasks();
    const modules = taskIds
        .filter(id => {
            if (showAll) return true;
            const handler = TaskRegistry.getHandler(id);
            return handler?.status === "prod";
        })
        .map(id => {
            const handler = TaskRegistry.getHandler(id)!;
            const category = id.split(":")[0];
            const meta = CATEGORY_MAP[category] || { icon: "📦" };
            const statusTag = showAll ? ` [${handler.status.toUpperCase()}]` : "";
            
            return {
                name: `${meta.icon} ${handler.name}${theme.dim(statusTag)}`,
                value: id,
                description: `${theme.primary(id)} › ${handler.description}`
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    return [
        ...modules,
        { 
            name: `${theme.muted("🔙 Go Back")}`, 
            value: "exit", 
            description: "Return to previous menu" 
        }
    ];
}
