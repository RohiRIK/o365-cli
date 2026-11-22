import chalk from "chalk";
/**
 * Violet & Zinc Design System
 */
export const COLORS = {
    violet: "#8b5cf6",
    zinc400: "#a1a1aa",
    zinc600: "#52525b",
};
export const theme = {
    /**
     * Primary color (Violet) for active selections, icons, and focus elements.
     */
    primary: chalk.hex(COLORS.violet),
    /**
     * Muted color (Zinc-400) for descriptions, separators, and breadcrumb history.
     */
    muted: chalk.hex(COLORS.zinc400),
    /**
     * Dim color (Zinc-600) for even more de-emphasized text.
     */
    dim: chalk.hex(COLORS.zinc600),
    /**
     * Error color (Red).
     */
    error: chalk.red,
    /**
     * Success color (Green).
     */
    success: chalk.green,
};
