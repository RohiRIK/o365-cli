import * as readline from "readline";
import { select } from "@inquirer/prompts";

function enableNavigationHotkeys(controller: AbortController) {
    if (process.stdin.isTTY) {
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(true);
        }
        
        process.stdin.on("keypress", (str, key) => {
            if (key.name === "q") {
                console.log("Q pressed, aborting...");
                controller.abort();
            }
        });
    }
}

async function run() {
    const controller = new AbortController();
    enableNavigationHotkeys(controller);

    try {
        const answer = await select({
            message: "Press 'q' to exit (testing AbortSignal)",
            choices: [
                { name: "Option 1", value: "1" },
                { name: "Option 2", value: "2" },
            ],
            theme: {
                helpMode: 'always' // To ensure we see help
            }
        }, { signal: controller.signal });
        console.log("Selected:", answer);
    } catch (e: any) {
        if (e.name === 'AbortError') {
             console.log("Caught AbortError!");
        } else {
             console.log("Caught error:", e.name, e.message);
        }
    } finally {
        process.exit(0);
    }
}

run();
