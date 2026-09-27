import { TaskRegistry, parseBooleanFlag } from "../registry";
import { auditPowerPlatformLicenses } from "../../commands/cost/power-platform";
class PowerPlatformHandler {
    taskId = "cost:power-platform";
    name = "Power Platform Governance";
    description = "Audit environments and app licensing costs";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return { dryRun: parseBooleanFlag(rawArgs, "dry-run", false) };
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditPowerPlatformLicenses(args.dryRun);
    }
}
TaskRegistry.register(new PowerPlatformHandler());
