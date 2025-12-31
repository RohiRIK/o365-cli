import { describe, it, expect, beforeEach, spyOn } from "bun:test";
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

  describe("Rendering", () => {
    it("should render a single breadcrumb correctly", () => {
      const rendered = nav.renderBreadcrumbs();
      // Should contain the current location highlighted
      expect(rendered).toContain("Control Center");
    });

    it("should render multiple breadcrumbs with visual hierarchy", () => {
      nav.push("Run a Module");
      nav.push("Security");
      const rendered = nav.renderBreadcrumbs();
      
      // Should contain all parts
      expect(rendered).toContain("Control Center");
      expect(rendered).toContain("Run a Module");
      expect(rendered).toContain("Security");
      
      // Should have separators
      expect(rendered).toContain(" › ");
    });

    it("should render a styled header", () => {
      const header = nav.renderHeader();
      expect(header).toBeString();
      expect(header).toContain("O365 CLI");
      expect(header).toContain("Control Center");
    });

    it("should provide a refresh method", () => {
      // Stub console methods
      const clearSpy = spyOn(console, "clear").mockImplementation(() => {});
      const logSpy = spyOn(console, "log").mockImplementation(() => {});
      
      nav.refresh();
      
      expect(clearSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();
      
      clearSpy.mockRestore();
      logSpy.mockRestore();
    });
  });
});
