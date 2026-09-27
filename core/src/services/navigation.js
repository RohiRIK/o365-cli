import boxen from "boxen";
import chalk from "chalk";
import { theme } from "../utils/theme";
export class NavigationService {
    stack = ["Control Center"];
    /**
     * Pushes a new location onto the navigation stack.
     */
    push(location) {
        this.stack.push(location);
    }
    /**
     * Pops the current location from the stack, unless it's the root.
     */
    pop() {
        if (this.stack.length > 1) {
            return this.stack.pop();
        }
        return undefined;
    }
    /**
     * Clears the navigation stack back to the root "Control Center".
     */
    clear() {
        this.stack = ["Control Center"];
    }
    /**
     * Returns the entire navigation stack as an array of breadcrumbs.
     */
    getBreadcrumbs() {
        return [...this.stack];
    }
    /**
     * Returns the current location (the top of the stack).
     */
    getCurrentLocation() {
        return this.stack[this.stack.length - 1];
    }
    /**
     * Renders the breadcrumb path with visual hierarchy.
     */
    renderBreadcrumbs() {
        return this.stack
            .map((loc, index) => {
            const isLast = index === this.stack.length - 1;
            return isLast ? theme.primary.bold(loc) : theme.muted(loc);
        })
            .join(theme.dim(" › "));
    }
    /**
     * Renders a styled header using boxen.
     */
    renderHeader() {
        const breadcrumbs = this.renderBreadcrumbs();
        const title = chalk.bold("O365 CLI");
        const content = `${title}\n\n${theme.dim("⚡")} ${breadcrumbs}`;
        return boxen(content, {
            padding: 1,
            margin: { top: 1, bottom: 1, left: 0, right: 0 },
            borderStyle: "round",
            borderColor: "#8b5cf6",
            dimBorder: true,
            width: 60,
        });
    }
    /**
     * Clears the console and renders the header.
     */
    refresh() {
        console.clear();
        console.log(this.renderHeader());
    }
}
