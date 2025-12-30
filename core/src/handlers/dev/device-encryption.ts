import { TaskHandler, TaskArgs, ValidationResult, TaskRegistry, parseBooleanFlag } from "../registry";
import { auditDeviceEncryption } from "../../commands/dev/device-encryption";

interface DeviceEncryptionArgs extends TaskArgs {
  dryRun: boolean;
}

class DeviceEncryptionHandler implements TaskHandler {
  taskId = "dev:device-encryption";

  parseArgs(rawArgs: string[]): DeviceEncryptionArgs {
    return { dryRun: parseBooleanFlag(rawArgs, "dry-run", true) };
  }

  validate(args: DeviceEncryptionArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: DeviceEncryptionArgs): Promise<void> {
    await auditDeviceEncryption(args.dryRun);
  }
}

TaskRegistry.register(new DeviceEncryptionHandler());
