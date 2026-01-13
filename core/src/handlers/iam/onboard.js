import { TaskRegistry, parseStringFlag, } from "../registry";
import { onboardUser } from "../../commands/iam/onboard";
class OnboardHandler {
    taskId = "iam:onboard";
    name = "User Onboarding";
    description = "Standardized protocol for new user setup";
    type = "action";
    status = "beta";
    parseArgs(rawArgs) {
        const firstname = parseStringFlag(rawArgs, "firstname", "");
        const lastname = parseStringFlag(rawArgs, "lastname", "");
        const department = parseStringFlag(rawArgs, "department", "");
        const templateUser = parseStringFlag(rawArgs, "template_user", "");
        return {
            firstname,
            lastname,
            department,
            templateUser: templateUser || undefined,
        };
    }
    validate(args) {
        if (!args.firstname || args.firstname.trim().length === 0) {
            return {
                valid: false,
                error: "First name is required",
            };
        }
        if (!args.lastname || args.lastname.trim().length === 0) {
            return {
                valid: false,
                error: "Last name is required",
            };
        }
        if (!args.department || args.department.trim().length === 0) {
            return {
                valid: false,
                error: "Department is required",
            };
        }
        // Validate template user email format if provided
        if (args.templateUser) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(args.templateUser)) {
                return {
                    valid: false,
                    error: `Invalid template user email format: ${args.templateUser}`,
                };
            }
        }
        return { valid: true };
    }
    async execute(args) {
        await onboardUser(args.firstname, args.lastname, args.department, args.templateUser);
    }
}
TaskRegistry.register(new OnboardHandler());
