import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditDeviceEncryption } from "../../commands/dev/device-encryption";

interface DeviceEncryptionArgs extends TaskArgs {
  dryRun: boolean;
}

class DeviceEncryptionHandler implements TaskHandler {
  taskId = "dev:device-encryption";
  name = "Device Encryption Audit";
  description = "Verify BitLocker and FileVault status";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): DeviceEncryptionArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
  }

  validate(args: DeviceEncryptionArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: DeviceEncryptionArgs): Promise<void> {
    await auditDeviceEncryption(args.dryRun);
  }
}

TaskRegistry.register(new DeviceEncryptionHandler());
