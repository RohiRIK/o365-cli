import { formatTable, printError, printSuccess } from "./output";
import chalk from "chalk";
/**
 * IPC Protocol v1.0
 * All messages include a version field for protocol compatibility checking
 */
export class IPC {
    static VERSION = "1.0";
    static mode = 'json';
    static lastTable = null;
    static lastResult = null;
    static progressCallback = null;
    static setMode(mode) {
        this.mode = mode;
    }
    static onProgress(cb) {
        this.progressCallback = cb;
    }
    static getLastTable() {
        return this.lastTable;
    }
    static getLastResult() {
        return this.lastResult;
    }
    static clearLastTable() {
        this.lastTable = null;
        this.lastResult = null;
    }
    /**
     * Internal helper to store table data for CSV export without printing to console
     */
    static setExportTable(headers, rows) {
        this.lastTable = { headers, rows };
    }
    // Send progress update
    static progress(message, percent) {
        if (this.mode === 'json') {
            console.log(JSON.stringify({ type: 'progress', version: this.VERSION, message, percent }));
        }
        else {
            if (this.progressCallback) {
                this.progressCallback(message, percent);
            }
            else {
                const p = percent !== undefined ? ` [${percent}%]` : '';
                console.log(chalk.blue(`  ${message}${p}`));
            }
        }
    }
    // Send final success result
    static success(data) {
        this.lastResult = data;
        if (this.mode === 'json') {
            console.log(JSON.stringify({ type: 'success', version: this.VERSION, data }));
        }
        else {
            if (data.message)
                printSuccess(data.message);
            if (data.table) {
                this.lastTable = data.table;
                console.log("\n" + formatTable(data.table.headers, data.table.rows));
            }
        }
    }
    // Send a standalone table
    static table(headers, rows) {
        if (this.mode === 'json') {
            console.log(JSON.stringify({ type: 'table', version: this.VERSION, headers, rows }));
        }
        else {
            this.lastTable = { headers, rows };
            console.log("\n" + formatTable(headers, rows));
        }
    }
    // Send real-time log
    static log(message, level = 'info') {
        if (this.mode === 'json') {
            console.log(JSON.stringify({ type: 'log', version: this.VERSION, message, level }));
        }
        else {
            const color = level === 'error' ? chalk.red : level === 'warn' ? chalk.yellow : chalk.blue;
            console.log(color(`  [${level.toUpperCase()}] ${message}`));
        }
    }
    // Send fatal error
    static error(message) {
        if (this.mode === 'json') {
            console.log(JSON.stringify({ type: 'error', version: this.VERSION, message }));
            process.exit(1);
        }
        else {
            printError(message);
            throw new Error(message); // Throw instead of exit to allow the orchestrator to handle it
        }
    }
    static getVersion() {
        return this.VERSION;
    }
}
