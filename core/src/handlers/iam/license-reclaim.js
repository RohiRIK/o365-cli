import { TaskRegistry, parseBooleanFlag, } from "../registry";
import { reclaimLicenses } from "../../commands/iam/license-reclaim";
class LicenseReclaimHandler {
    taskId = "iam:license-reclaim";
    name = "License Reclamation";
    description = "Identify and reclaim unused M365 licenses";
    type = "action";
    status = "draft";
    parseArgs(rawArgs) {
        const dryRun = parseBooleanFlag(rawArgs, "dry-run", true);
        return { dryRun };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await reclaimLicenses(args.dryRun);
    }
}
TaskRegistry.register(new LicenseReclaimHandler());
