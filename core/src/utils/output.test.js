import { describe, it, expect } from "bun:test";
import { formatTable } from "./output";
describe("Output Utils", () => {
    it("should format a table correctly", () => {
        const headers = ["ID", "Name"];
        const rows = [["1", "Alpha"], ["2", "Beta"]];
        const output = formatTable(headers, rows);
        expect(output).toContain("ID");
        expect(output).toContain("Alpha");
    });
});
