export class NavigationService {
  private stack: string[] = ["Control Center"];

  /**
   * Pushes a new location onto the navigation stack.
   */
  push(location: string): void {
    this.stack.push(location);
  }

  /**
   * Pops the current location from the stack, unless it's the root.
   */
  pop(): string | undefined {
    if (this.stack.length > 1) {
      return this.stack.pop();
    }
    return undefined;
  }

  /**
   * Clears the navigation stack back to the root "Control Center".
   */
  clear(): void {
    this.stack = ["Control Center"];
  }

  /**
   * Returns the entire navigation stack as an array of breadcrumbs.
   */
  getBreadcrumbs(): string[] {
    return [...this.stack];
  }

  /**
   * Returns the current location (the top of the stack).
   */
  getCurrentLocation(): string {
    return this.stack[this.stack.length - 1];
  }
}
