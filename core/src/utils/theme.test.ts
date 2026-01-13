import { describe, it, expect } from "bun:test";
import { theme } from "./theme";

describe("Theme", () => {
  it("should have color functions", () => {
    expect(theme.primary).toBeFunction();
    expect(theme.muted).toBeFunction();
    expect(theme.dim).toBeFunction();
    expect(theme.error).toBeFunction();
    expect(theme.success).toBeFunction();
  });

  it("should apply colors to strings", () => {
    // We can't easily test the exact escape codes without making it brittle,
    // but we can check if it returns a string.
    expect(theme.primary("test")).toBeString();
    expect(theme.muted("test")).toBeString();
  });
});
