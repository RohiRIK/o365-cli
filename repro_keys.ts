import * as readline from "readline";
import { select } from "@inquirer/prompts";

function enableNavigationHotkeys() {
    if (process.stdin.isTTY) {
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(true);
        }
        
        process.stdin.on("keypress", (str, key) => {
            if (key.name === "q") {
                console.log("Q pressed, scheduling escape push...");
                setTimeout(() => {
                    process.stdin.push("\x1b"); 
                }, 0);
            }
        });
    }
}

enableNavigationHotkeys();

async function run() {
    try {
        const answer = await select({
            message: "Press 'q' to exit (testing async push)",
            choices: [
                { name: "Option 1", value: "1" },
                { name: "Option 2", value: "2" },
            ],
        });
        console.log("Selected:", answer);
    } catch (e) {
        console.log("Caught error:", e.message);
    }
}

run();
