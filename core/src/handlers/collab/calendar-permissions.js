import { TaskRegistry, } from "../registry";
import { auditCalendarPermissions } from "../../commands/collab/calendar-permissions";
class CalendarPermissionsHandler {
    taskId = "collab:calendar-permissions";
    name = "Calendar Permissions Audit";
    description = "Audit calendar delegate and sharing permissions";
    type = "audit";
    status = "draft";
    parseArgs(rawArgs) {
        return {};
    }
    validate(args) {
        return { valid: true };
    }
    async execute(args) {
        await auditCalendarPermissions();
    }
}
TaskRegistry.register(new CalendarPermissionsHandler());
