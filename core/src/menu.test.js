import { describe, it, expect } from "bun:test";
import { getCategoryChoices, getModulesInCategory, getAllModuleChoices } from "./utils/menu";
import { TaskRegistry } from "./handlers/registry";
describe("Menu Helper Logic", () => {
    const mockTasks = [
        "iam:offboard",
        "iam:onboard",
        "sec:shadow-it",
        "dev:intune-audit"
    ];
    it("should correctly identify unique categories with icons", () => {
        const choices = getCategoryChoices(mockTasks);
        expect(choices).toHaveLength(3);
        expect(choices[0].name).toContain("💻 Device Management");
        expect(choices[1].name).toContain("👤 Identity & Access");
        expect(choices[2].name).toContain("🛡️ Security & Audit");
    });
    it("should filter modules correctly by category", () => {
        const iamModules = getModulesInCategory(mockTasks, "iam");
        expect(iamModules).toHaveLength(2);
        expect(iamModules[0].value).toBe("iam:offboard");
        expect(iamModules[1].value).toBe("iam:onboard");
    });
    it("should handle unknown categories gracefully", () => {
        const modules = getModulesInCategory(["unknown:task"], "iam");
        expect(modules).toEqual([]);
    });
    it("should return searchable choices for all modules", () => {
        // Ensure at least one task is registered
        TaskRegistry.register({
            taskId: "sec:shadow-it",
            name: "Shadow IT Governance",
            description: "Detect and remediate risky OAuth applications",
            type: "action",
            status: "prod",
            execute: async () => { },
            parseArgs: () => ({ dryRun: true }),
            validate: () => ({ valid: true })
        });
        const choices = getAllModuleChoices(true);
        expect(choices.length).toBeGreaterThan(0);
        expect(choices.some(c => c.value === "exit")).toBeTrue();
        const shadowIT = choices.find(c => c.value === "sec:shadow-it");
        expect(shadowIT).toBeDefined();
        expect(shadowIT?.name).toContain("Shadow IT Governance");
    });
});
