import { TaskRegistry, parseBooleanFlag } from "../registry";
import { auditDeviceEncryption } from "../../commands/dev/device-encryption";
class DeviceEncryptionHandler {
    taskId = "dev:device-encryption";
    name = "Device Encryption Audit";
    description = "Verify BitLocker and FileVault status";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditDeviceEncryption(args.dryRun);
    }
}
TaskRegistry.register(new DeviceEncryptionHandler());
