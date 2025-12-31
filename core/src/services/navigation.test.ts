import { describe, it, expect, beforeEach } from "bun:test";
import { NavigationService } from "./navigation";

describe("NavigationService", () => {
  let nav: NavigationService;

  beforeEach(() => {
    nav = new NavigationService();
  });

  it("should start with 'Control Center' as the default location", () => {
    expect(nav.getCurrentLocation()).toBe("Control Center");
    expect(nav.getBreadcrumbs()).toEqual(["Control Center"]);
  });

  it("should allow pushing new locations", () => {
    nav.push("Run a Module");
    expect(nav.getCurrentLocation()).toBe("Run a Module");
    expect(nav.getBreadcrumbs()).toEqual(["Control Center", "Run a Module"]);

    nav.push("Security");
    expect(nav.getCurrentLocation()).toBe("Security");
    expect(nav.getBreadcrumbs()).toEqual(["Control Center", "Run a Module", "Security"]);
  });

  it("should allow popping locations", () => {
    nav.push("Run a Module");
    nav.push("Security");
    
    const popped = nav.pop();
    expect(popped).toBe("Security");
    expect(nav.getCurrentLocation()).toBe("Run a Module");
    expect(nav.getBreadcrumbs()).toEqual(["Control Center", "Run a Module"]);
  });

  it("should not pop the root 'Control Center'", () => {
    const popped = nav.pop();
    expect(popped).toBeUndefined();
    expect(nav.getCurrentLocation()).toBe("Control Center");
    expect(nav.getBreadcrumbs()).toEqual(["Control Center"]);
  });

  it("should allow clearing the stack back to root", () => {
    nav.push("Run a Module");
    nav.push("Security");
    nav.clear();
    expect(nav.getCurrentLocation()).toBe("Control Center");
    expect(nav.getBreadcrumbs()).toEqual(["Control Center"]);
  });
});
