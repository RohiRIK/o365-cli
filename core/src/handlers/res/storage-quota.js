import { TaskRegistry, parseBooleanFlag } from "../registry";
import { analyzeStorageQuota } from "../../commands/res/storage-quota";
class StorageQuotaHandler {
    taskId = "res:storage-quota";
    name = "Storage Quota Audit";
    description = "Analyze storage usage across SPO and OneDrive";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await analyzeStorageQuota(args.dryRun);
    }
}
TaskRegistry.register(new StorageQuotaHandler());
