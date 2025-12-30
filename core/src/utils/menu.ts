import chalk from "chalk";

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
 * Gets a list of unique categories from registered task IDs
 */
export function getCategoryChoices(taskIds: string[]) {
    const prefixes = new Set(taskIds.map(id => id.split(":")[0]));
    return Array.from(prefixes).sort().map(prefix => {
        const meta = CATEGORY_MAP[prefix] || { name: prefix.toUpperCase(), icon: "⚙️" };
        return {
            name: `${meta.icon} ${meta.name}`,
            value: prefix
        };
    });
}

/**
 * Gets modules filtered by a specific category
 */
export function getModulesInCategory(taskIds: string[], category: string) {
    if (category === "sys") {
        return [
            { name: `  ${chalk.cyan("→")} sys:settings`, value: "sys:settings", description: "Manage logins and accounts" },
            { name: `  ${chalk.cyan("→")} sys:status`, value: "sys:status", description: "View detailed session info" }
        ];
    }
    return taskIds
        .filter(id => id.startsWith(`${category}:`))
        .sort()
        .map(id => ({
            name: `  ${chalk.cyan("→")} ${id}`,
            value: id,
            description: `Run module ${id}`
        }));
}
