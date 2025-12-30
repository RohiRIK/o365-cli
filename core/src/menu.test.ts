import { describe, it, expect, mock } from "bun:test";
import { getCategoryChoices, getModulesInCategory } from "./utils/menu";

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
        const customTasks = ["custom:test"];
        const choices = getCategoryChoices(customTasks);
        expect(choices[0].name).toBe("⚙️ CUSTOM");
    });
});
