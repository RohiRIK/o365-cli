import {
  TaskHandler,
  TaskArgs,
  ValidationResult,
  TaskRegistry,
} from "../registry";
import { auditCalendarPermissions } from "../../commands/collab/calendar-permissions";

interface CalendarPermissionsArgs extends TaskArgs {}

class CalendarPermissionsHandler implements TaskHandler {
  taskId = "collab:calendar-permissions";
  type = "audit" as const;
  status = "draft" as const;

  parseArgs(rawArgs: string[]): CalendarPermissionsArgs {
    return {};
  }

  validate(args: CalendarPermissionsArgs): ValidationResult {
    return { valid: true };
  }

  async execute(args: CalendarPermissionsArgs): Promise<void> {
    await auditCalendarPermissions();
  }
}

TaskRegistry.register(new CalendarPermissionsHandler());
