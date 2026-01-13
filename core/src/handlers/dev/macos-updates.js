import { TaskRegistry, parseBooleanFlag } from "../registry";
import { auditMacOSUpdates } from "../../commands/dev/macos-updates";
class MacOSUpdatesHandler {
    taskId = "dev:macos-compliance";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditMacOSUpdates(args.dryRun);
    }
}
TaskRegistry.register(new MacOSUpdatesHandler());
