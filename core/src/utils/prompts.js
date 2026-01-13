import { select as originalSelect, input as originalInput, confirm as originalConfirm } from "@inquirer/prompts";
import originalSearch from "@inquirer/search";
import * as readline from "readline";
let activeController = null;
/**
 * Cancels the currently active prompt if one exists.
 */
export function cancelCurrentPrompt() {
    if (activeController) {
        activeController.abort();
    }
}
/**
 * sets up the global key listener for 'q' to trigger cancellation.
 * Call this once at startup.
 */
export function enableGlobalCancellation() {
    if (process.stdin.isTTY) {
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(true);
        }
        process.stdin.on("keypress", (str, key) => {
            // If 'q' is pressed (and not while typing in an input field)
            // Note: We might need better logic to detect if typing, 
            // but for menus 'q' is usually safe.
            // For text input, this might be annoying.
            // But the original code had this logic.
            if (key.name === "q" && !key.ctrl && !key.meta) {
                cancelCurrentPrompt();
            }
        });
    }
}
async function wrapPrompt(promptFn, config) {
    const controller = new AbortController();
    activeController = controller;
    try {
        return await promptFn(config, { signal: controller.signal });
    }
    catch (error) {
        if (error.name === 'AbortError') {
            // Throw a generic error that the CLI loop expects for cancellation
            throw new Error("Prompt cancelled");
        }
        throw error;
    }
    finally {
        if (activeController === controller) {
            activeController = null;
        }
    }
}
export const select = (config) => wrapPrompt(originalSelect, config);
export const input = (config) => wrapPrompt(originalInput, config);
export const confirm = (config) => wrapPrompt(originalConfirm, config);
export const search = (config) => wrapPrompt(originalSearch, config);
// Re-export specific types or helpers if needed, but for now just the functions
export { Separator } from "@inquirer/prompts";
