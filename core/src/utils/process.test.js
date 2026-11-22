import { describe, it, expect, spyOn } from "bun:test";
import { setupSignalHandlers } from "./process";
describe("Process Utils", () => {
    it("should set up SIGINT and SIGTERM handlers", () => {
        const onSpy = spyOn(process, "on");
        setupSignalHandlers();
        expect(onSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
        expect(onSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
        expect(onSpy).toHaveBeenCalledWith("exit", expect.any(Function));
    });
});
