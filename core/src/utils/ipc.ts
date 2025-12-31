import { formatTable, printError, printInfo, printSuccess } from "./output";
import chalk from "chalk";

/**
 * IPC Protocol v1.0
 * All messages include a version field for protocol compatibility checking
 */
export class IPC {
  private static readonly VERSION = "1.0";
  private static mode: 'json' | 'pretty' = 'json';
  private static lastTable: { headers: string[], rows: any[][] } | null = null;
  private static progressCallback: ((message: string, percent?: number) => void) | null = null;

  static setMode(mode: 'json' | 'pretty') {
    this.mode = mode;
  }

  static onProgress(cb: (message: string, percent?: number) => void) {
    this.progressCallback = cb;
  }

  static getLastTable() {
    return this.lastTable;
  }

  static clearLastTable() {
    this.lastTable = null;
  }

  /**
   * Internal helper to store table data for CSV export without printing to console
   */
  static setExportTable(headers: string[], rows: any[][]) {
    this.lastTable = { headers, rows };
  }

  // Send progress update
  static progress(message: string, percent?: number) {
    if (this.mode === 'json') {
        console.log(JSON.stringify({ type: 'progress', version: this.VERSION, message, percent }));
    } else {
        if (this.progressCallback) {
            this.progressCallback(message, percent);
        } else {
            const p = percent !== undefined ? ` [${percent}%]` : '';
            console.log(chalk.blue(`  ${message}${p}`));
        }
    }
  }

  // Send final success result
  static success(data: any) {
    if (this.mode === 'json') {
        console.log(JSON.stringify({ type: 'success', version: this.VERSION, data }));
    } else {
        if (data.message) printSuccess(data.message);
        if (data.table) {
            this.lastTable = data.table;
            console.log("\n" + formatTable(data.table.headers, data.table.rows));
        }
    }
  }

  // Send a standalone table
  static table(headers: string[], rows: any[][]) {
    if (this.mode === 'json') {
        console.log(JSON.stringify({ type: 'table', version: this.VERSION, headers, rows }));
    } else {
        this.lastTable = { headers, rows };
        console.log("\n" + formatTable(headers, rows));
    }
  }

  // Send real-time log
  static log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    if (this.mode === 'json') {
        console.log(JSON.stringify({ type: 'log', version: this.VERSION, message, level }));
    } else {
        const color = level === 'error' ? chalk.red : level === 'warn' ? chalk.yellow : chalk.blue;
        console.log(color(`  [${level.toUpperCase()}] ${message}`));
    }
  }

  // Send fatal error
  static error(message: string) {
    if (this.mode === 'json') {
        console.log(JSON.stringify({ type: 'error', version: this.VERSION, message }));
        process.exit(1);
    } else {
        printError(message);
        throw new Error(message); // Throw instead of exit to allow the orchestrator to handle it
    }
  }

  static getVersion(): string {
    return this.VERSION;
  }
}
