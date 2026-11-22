import Table from "cli-table3";
import chalk from "chalk";
export function formatTable(headers, rows) {
    const table = new Table({
        head: headers.map(h => chalk.cyan(h)),
        chars: {
            'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
            'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
            'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
            'right': '║', 'right-mid': '╢', 'middle': '│'
        }
    });
    table.push(...rows);
    return table.toString();
}
export function printError(message) {
    console.error(chalk.red.bold("ERROR: ") + message);
}
export function printSuccess(message) {
    console.log(chalk.green.bold("SUCCESS: ") + message);
}
export function printInfo(message) {
    console.log(chalk.blue.bold("INFO: ") + message);
}
