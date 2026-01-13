import { TaskRegistry } from "./handlers/registry";
import { GraphService } from "./services/graph";
// Import all task handlers (auto-register on import)
// IAM modules
import "./handlers/iam/offboard";
import "./handlers/iam/onboard";
import "./handlers/iam/guest-cleanup";
import "./handlers/iam/license-reclaim";
import "./handlers/iam/stale-accounts";
// Security modules
import "./handlers/sec/shadow-it";
import "./handlers/sec/mfa-enforcement";
import "./handlers/sec/risky-sign-ins";
import "./handlers/sec/conditional-access-gaps";
import "./handlers/sec/privileged-access-audit";
import "./handlers/sec/app-permissions-audit";
import "./handlers/sec/external-user-access";
import "./handlers/sec/password-expiry-audit";
import "./handlers/sec/security-defaults-check";
import "./handlers/sec/surgical-lockdown";
import "./handlers/sec/external-sharing";
import "./handlers/sec/mailbox-permissions";
// Governance modules
import "./handlers/gov/gdpr-export";
import "./handlers/gov/audit-log-export";
import "./handlers/gov/retention-audit";
import "./handlers/gov/dlp-violations";
// Device Management modules
import "./handlers/dev/windows-updates";
import "./handlers/dev/macos-updates";
import "./handlers/dev/mobile-compliance";
import "./handlers/dev/device-encryption";
import "./handlers/dev/bitlocker-audit";
import "./handlers/dev/stale-devices";
// Resources/Cost modules
import "./handlers/res/license-optimization";
import "./handlers/res/device-cleanup";
import "./handlers/res/storage-quota";
import "./handlers/res/inactive-groups";
import "./handlers/res/teams-usage";
import "./handlers/res/sharepoint-permissions";
import "./handlers/cost/power-platform";
import "./handlers/cost/mailbox-sizing";
import "./handlers/cost/unused-groups";
// Collaboration modules
import "./handlers/collab/onedrive-sprawl";
import "./handlers/collab/calendar-permissions";
import "./handlers/collab/shared-mailboxes";
// Reporting modules
import "./handlers/rep/executive-dashboard";
import "./handlers/rep/compliance-scorecard";
import "./handlers/rep/teams-sprawl";
import "./handlers/rep/user-analyzer";
const args = process.argv.slice(2);
const command = args[0];
const subArgs = args.slice(1);
async function main() {
    // Initialize token from stdin before any commands run
    await GraphService.initialize();
    // Execute task via registry (replaces hardcoded switch statement)
    await TaskRegistry.execute(command, subArgs);
}
main().catch(err => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
});
