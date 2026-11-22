import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { analyzeStorageQuota } from "../../commands/res/storage-quota";

interface StorageQuotaArgs extends TaskArgs {
  dryRun: boolean;
}

class StorageQuotaHandler implements TaskHandler {
  taskId = "res:storage-quota";
  name = "Storage Quota Audit";
  description = "Analyze storage usage across SPO and OneDrive";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): StorageQuotaArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
  }

  validate(args: StorageQuotaArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: StorageQuotaArgs): Promise<void> {
    await analyzeStorageQuota(args.dryRun);
  }
}

TaskRegistry.register(new StorageQuotaHandler());
