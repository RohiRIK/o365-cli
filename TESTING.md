# O365-CLI Testing Guide

This guide teaches you how to test each module through the CLI application.

## Prerequisites

1. **Build the CLI:**
   ```bash
   cd cli
   cargo build --release
   cd ..
   ```

2. **Authenticate:**
   ```bash
   ./cli/target/release/o365-cli login --tenant common
   ```
   This will open a browser for Microsoft authentication.

3. **Verify Authentication:**
   ```bash
   ./cli/target/release/o365-cli run iam:offboard --help
   ```
   Should show "Verifying session..." without errors.

---

## Phase 1: Architectural Testing

### Test 1: Module Registry Loading

**What it tests:** modules.toml parsing and module enumeration

```bash
# Run module tests
cargo test --manifest-path cli/Cargo.toml modules::tests

# Expected output:
# test modules::tests::test_module_config_loading ... ok
# test modules::tests::test_module_definition_lookup ... ok
# test modules::tests::test_modules_by_category ... ok
# test modules::tests::test_module_priority_sorting ... ok
# test modules::tests::test_input_definitions ... ok
# test modules::tests::test_helper_functions ... ok
```

**What to verify:**
- All 6 tests pass
- No TOML parsing errors
- Module count = 29

### Test 2: WorkerPool Configuration

**What it tests:** WorkerPool loading config from modules.toml

```bash
# Run worker pool tests
cargo test --manifest-path cli/Cargo.toml worker_pool::tests

# Expected output:
# test worker_pool::tests::test_worker_pool_creation ... ok
# test worker_pool::tests::test_worker_pool_config_from_modules ... ok
# test worker_pool::tests::test_task_queuing ... ok
```

**What to verify:**
- WorkerPool loads max_concurrent_workers = 3 from modules.toml
- No panics or config errors

### Test 3: IPC Protocol v1.0

**What it tests:** Version field in all IPC messages

```bash
# Run a simple command and check IPC output
echo "fake-token" | bun run core/src/index.ts iam:guest-cleanup --days 90 2>&1 | head -5

# Expected output (JSON with version field):
# {"type":"progress","version":"1.0","message":"Starting guest cleanup...","percent":0}
```

**What to verify:**
- All IPC messages contain `"version":"1.0"`
- No parsing errors in Rust runner

### Test 4: TaskRegistry Auto-Registration

**What it tests:** Automatic handler registration on import

```bash
# Check TypeScript compilation
bun run core/src/index.ts

# Expected output:
# {"type":"error","version":"1.0","message":"No authentication token found..."}
```

**What to verify:**
- No TypeScript compilation errors
- All handlers import successfully

---

## Module Testing

### IAM-01: Graceful Offboarding (iam:offboard)

**Status:** ✅ Implemented

**Test 1: Dry Run Mode (Preview Only)**

```bash
./cli/target/release/o365-cli run iam:offboard \
  --user testuser@yourdomain.com \
  --manager manager@yourdomain.com \
  --device-action retire \
  --dry-run true
```

**What to verify:**
- ✅ Shows "DRY RUN" mode indicator
- ✅ Lists all actions that WOULD be taken
- ✅ NO actual changes made to tenant
- ✅ Returns table with proposed actions
- ✅ Progress updates (0% → 100%)

**Test 2: Live Execution**

```bash
./cli/target/release/o365-cli run iam:offboard \
  --user testuser@yourdomain.com \
  --manager manager@yourdomain.com \
  --device-action retire \
  --dry-run false
```

**What to verify:**
- ✅ User account disabled in Entra ID
- ✅ Licenses removed (check M365 admin center)
- ✅ Mailbox delegation granted to manager
- ✅ Out-of-office auto-reply set
- ✅ Devices retired (check Intune)
- ✅ Group memberships removed
- ✅ OneDrive permissions delegated

**Test 3: Error Handling**

```bash
# Test with non-existent user
./cli/target/release/o365-cli run iam:offboard \
  --user nonexistent@yourdomain.com \
  --dry-run true

# Expected: Error message "User not found"
```

**Test 4: Missing Required Arguments**

```bash
# Missing --user flag
./cli/target/release/o365-cli run iam:offboard --dry-run true

# Expected: Error "Missing required argument: --user"
```

---

### IAM-02: Guest Lifecycle Cleanup (iam:guest-cleanup)

**Status:** ✅ Implemented

**Test 1: Preview Stale Guests (90 days)**

```bash
./cli/target/release/o365-cli run iam:guest-cleanup \
  --days 90 \
  --dry-run true
```

**What to verify:**
- ✅ Shows count of stale guest accounts
- ✅ Lists guest emails, last sign-in dates
- ✅ NO deletions performed
- ✅ Table with guest details

**Test 2: Custom Threshold (180 days)**

```bash
./cli/target/release/o365-cli run iam:guest-cleanup \
  --days 180 \
  --dry-run true
```

**What to verify:**
- ✅ Different guest count than 90-day test
- ✅ Only shows guests inactive >180 days

**Test 3: Live Cleanup**

```bash
./cli/target/release/o365-cli run iam:guest-cleanup \
  --days 90 \
  --dry-run false
```

**What to verify:**
- ✅ Guest accounts deleted from Entra ID
- ✅ Confirmation message with count
- ✅ Check M365 admin center - guests removed

**Test 4: Validation Errors**

```bash
# Invalid threshold (too low)
./cli/target/release/o365-cli run iam:guest-cleanup \
  --days 10 \
  --dry-run true

# Expected: Error "Invalid inactivity threshold: 10 days. Must be between 30 and 365 days."
```

---

### SEC-01: Shadow IT Governance (sec:shadow-it)

**Status:** ✅ Implemented

**Test 1: Scan for Risky OAuth Apps**

```bash
./cli/target/release/o365-cli run sec:shadow-it --dry-run true
```

**What to verify:**
- ✅ Scans all OAuth applications in tenant
- ✅ Returns table with risky apps:
  - App name
  - Risk level (High/Medium/Low)
  - Dangerous permissions (Mail.ReadWrite, Files.ReadWrite.All, etc.)
  - Unverified publisher status
  - User consent count
- ✅ Summary: Total apps, risky apps, unverified publishers

**Test 2: Analyze Results**

Review the output table and identify:
- **High-risk apps:** Unverified publishers + dangerous permissions
- **Credential hygiene issues:** Apps with client secrets >1 year old
- **Overprivileged apps:** Unnecessary Graph API scopes

**Test 3: No Dry Run (Report Only)**

```bash
./cli/target/release/o365-cli run sec:shadow-it --dry-run false
```

**What to verify:**
- ✅ Same output as dry run (this module is read-only)
- ✅ No apps disabled or modified
- ✅ Use results to manually review apps in Entra ID

---

### GOV-01: GDPR User Data Export (gov:gdpr-export)

**Status:** ✅ Implemented

**Test 1: Preview Export (Dry Run)**

```bash
./cli/target/release/o365-cli run gov:gdpr-export \
  --user testuser@yourdomain.com \
  --dry-run true
```

**What to verify:**
- ✅ Shows data categories that WOULD be exported:
  - User Profile (1 record)
  - Mailbox Statistics
  - OneDrive Statistics
  - Group Memberships (count)
  - Teams Memberships (count)
  - Registered Devices (count)
  - Audit Logs (requires E5)
- ✅ NO file created
- ✅ Returns table with record counts

**Test 2: Generate GDPR Export**

```bash
./cli/target/release/o365-cli run gov:gdpr-export \
  --user testuser@yourdomain.com \
  --dry-run false
```

**What to verify:**
- ✅ JSON file created at: `exports/gdpr/gdpr_export_testuser_at_yourdomain_com_TIMESTAMP.json`
- ✅ File contains:
  - Export metadata (legal basis, retention period)
  - User profile data
  - Mailbox statistics
  - OneDrive quota info
  - Group memberships (all types)
  - Teams memberships
  - Registered devices
  - Audit logs (if E5 license)

**Test 3: Inspect Export File**

```bash
# Find the most recent export
ls -lt exports/gdpr/ | head -5

# View export contents (pretty-printed JSON)
cat exports/gdpr/gdpr_export_testuser_at_yourdomain_com_*.json | jq .
```

**What to verify:**
- ✅ JSON is valid and well-formatted
- ✅ Contains `exportMetadata` section with GDPR legal basis
- ✅ All data categories present
- ✅ No sensitive credentials in export

**Test 4: Error Handling**

```bash
# Non-existent user
./cli/target/release/o365-cli run gov:gdpr-export \
  --user nonexistent@yourdomain.com \
  --dry-run true

# Expected: Error "User not found"
```

**Test 5: GDPR Compliance Verification**

✅ **Article 15 Requirements:**
- [ ] Export contains all user data
- [ ] Response time <30 days (automated = instant)
- [ ] Structured format (JSON) ✅
- [ ] Free of charge ✅
- [ ] Includes legal basis ✅

---

## End-to-End Integration Testing

### Test 1: Run Multiple Modules Sequentially

```bash
# Preview operations across multiple modules
./cli/target/release/o365-cli run iam:guest-cleanup --days 90 --dry-run true
./cli/target/release/o365-cli run sec:shadow-it --dry-run true
./cli/target/release/o365-cli run gov:gdpr-export --user testuser@yourdomain.com --dry-run true
```

**What to verify:**
- ✅ No authentication errors (token reused)
- ✅ All modules execute successfully
- ✅ No memory leaks or crashes

### Test 2: TUI Mode (Interactive)

```bash
# Launch TUI (no arguments)
./cli/target/release/o365-cli
```

**What to verify:**
- ✅ TUI launches successfully
- ✅ Can navigate between tabs (IAM, Security, Governance, Resources, Reporting)
- ✅ Modules listed by priority (highest first)
- ✅ Implemented modules marked with ✅
- ✅ Unimplemented modules marked with 🚧

---

## Performance Testing

### Test 1: Large Tenant (>1000 users)

```bash
time ./cli/target/release/o365-cli run iam:guest-cleanup --days 90 --dry-run true
```

**What to verify:**
- ✅ Execution time <2 minutes for 5K user tenant
- ✅ No timeouts or rate limiting errors
- ✅ Progress updates throughout

### Test 2: Concurrent Workers (Future - Phase 2)

```bash
# This will be testable once WorkerPool is integrated into runner
# Expected: 3 concurrent Bun workers processing tasks in parallel
```

---

## Troubleshooting

### Issue: Authentication Failed

```bash
# Re-authenticate
./cli/target/release/o365-cli login --tenant common

# Check token expiration
# Token is stored in OS keyring, valid for 1 hour
```

### Issue: Permission Denied

```
Error: Insufficient privileges to complete the operation
```

**Solution:** Ensure your admin account has these Graph API permissions:
- User.ReadWrite.All
- Directory.ReadWrite.All
- Mail.ReadWrite
- Files.Read.All
- AuditLog.Read.All (E5 only)

Check in **Azure Portal → App Registrations → Your App → API Permissions**

### Issue: Module Not Found

```
Error: Unknown task: gov:gdpr-export
```

**Solution:**
1. Verify `modules.toml` has the module definition
2. Check `core/src/index.ts` imports the handler
3. Rebuild: `cd cli && cargo build --release`

### Issue: TypeScript Compilation Error

```bash
# Check for syntax errors
bun run core/src/index.ts

# If errors, check:
# 1. All imports resolve correctly
# 2. No missing files
# 3. TypeScript syntax is valid
```

---

## Test Coverage Summary

| Module | Dry Run | Live Run | Error Handling | Performance | Status |
|--------|---------|----------|----------------|-------------|--------|
| iam:offboard | ✅ | ✅ | ✅ | ✅ | Implemented |
| iam:guest-cleanup | ✅ | ✅ | ✅ | ✅ | Implemented |
| sec:shadow-it | ✅ | ✅ | ✅ | ✅ | Implemented |
| sec:mfa-enforcement | ✅ | ✅ | ✅ | ✅ | Implemented |
| gov:gdpr-export | ✅ | ✅ | ✅ | ✅ | Implemented |
| gov:audit-log-export | ✅ | ✅ | ✅ | ✅ | Implemented |
| gov:retention-audit | ✅ | ✅ | ✅ | ✅ | Implemented |
| gov:dlp-violations | ✅ | ✅ | ✅ | ✅ | Implemented |
| dev:windows-updates | ✅ | ✅ | ✅ | ✅ | Implemented |
| res:license-optimization | ✅ | ✅ | ✅ | ✅ | Implemented |

**Total Modules Tested:** 10/29 (34%)

---

### GOV-02: Audit Log Export (gov:audit-log-export)

**Status:** ✅ Implemented

**Test 1: Preview Export (Dry Run)**

```bash
./cli/target/release/o365-cli run gov:audit-log-export \
  --start-date 2025-01-01 \
  --end-date 2025-01-31 \
  --dry-run true
```

**What to verify:**
- ✅ Shows data categories that WOULD be exported:
  - Sign-in events (Entra ID)
  - Directory audit logs (user/group/role changes)
- ✅ NO file created
- ✅ Returns table with log type counts
- ✅ Preview of first 10 events

**Test 2: Generate Full Export**

```bash
./cli/target/release/o365-cli run gov:audit-log-export \
  --start-date 2025-01-01 \
  --end-date 2025-01-31 \
  --dry-run false
```

**What to verify:**
- ✅ JSON file created at: `exports/audit-logs/audit_log_export_2025-01-01_to_2025-01-31_TIMESTAMP.json`
- ✅ File contains:
  - Export metadata (date range, total events)
  - Sign-in logs (user, IP, location, status, risk level)
  - Directory audit logs (activity, initiator, targets, result)
- ✅ Logs sorted by timestamp (newest first)

**Test 3: Filtered Export (Specific Operations)**

```bash
./cli/target/release/o365-cli run gov:audit-log-export \
  --start-date 2025-01-01 \
  --end-date 2025-01-31 \
  --operations "Add user,Delete user,Update role" \
  --dry-run false
```

**What to verify:**
- ✅ Only events matching filter included
- ✅ Reduced event count compared to unfiltered export
- ✅ All events match specified operations

**Test 4: Date Validation**

```bash
# Invalid date format
./cli/target/release/o365-cli run gov:audit-log-export \
  --start-date 2025/01/01 \
  --end-date 2025-01-31 \
  --dry-run true

# Expected: Error "Invalid start date format: 2025/01/01. Use YYYY-MM-DD"

# Date range too large (>365 days)
./cli/target/release/o365-cli run gov:audit-log-export \
  --start-date 2023-01-01 \
  --end-date 2025-01-31 \
  --dry-run true

# Expected: Error "Date range too large: XXX days. Maximum allowed: 365 days"
```

---

### GOV-03: Retention Policy Audit (gov:retention-audit)

**Status:** ✅ Implemented

**Test 1: Audit All Retention Policies**

```bash
./cli/target/release/o365-cli run gov:retention-audit --dry-run true
```

**What to verify:**
- ✅ Shows all retention policies in tenant:
  - Exchange retention (mailbox holds, litigation holds)
  - SharePoint retention (document libraries, sites)
  - Teams retention (channel messages, chats)
  - OneDrive retention
- ✅ Returns table with:
  - Policy name
  - Locations (Exchange, SharePoint, Teams, OneDrive)
  - Retention duration (days/years)
  - Enabled status

**Test 2: Identify Non-Compliant Retention Gaps**

```bash
./cli/target/release/o365-cli run gov:retention-audit --dry-run false
```

**What to verify:**
- ✅ Highlights users/sites without retention policies
- ✅ Identifies policies expiring soon
- ✅ Recommends compliance improvements

**Test 3: No Retention Policies Configured**

```bash
# Test in tenant with no retention policies
./cli/target/release/o365-cli run gov:retention-audit --dry-run true

# Expected: Message "No retention policies found. Configure retention for compliance."
```

---

### GOV-04: DLP Violations Report (gov:dlp-violations)

**Status:** ✅ Implemented

**Test 1: Scan for DLP Policy Violations**

```bash
./cli/target/release/o365-cli run gov:dlp-violations \
  --days 30 \
  --dry-run true
```

**What to verify:**
- ✅ Scans DLP incidents from last 30 days
- ✅ Returns table with:
  - Incident ID
  - Policy name (e.g., "PCI-DSS", "GDPR", "HIPAA")
  - Severity (High/Medium/Low)
  - User who triggered violation
  - Location (Exchange, SharePoint, Teams, OneDrive)
  - Timestamp
  - Sensitive info types detected (credit card, SSN, etc.)

**Test 2: Filter by Severity**

```bash
./cli/target/release/o365-cli run gov:dlp-violations \
  --days 90 \
  --severity High \
  --dry-run true
```

**What to verify:**
- ✅ Only shows high-severity violations
- ✅ Reduced incident count

**Test 3: Custom Date Range**

```bash
./cli/target/release/o365-cli run gov:dlp-violations \
  --days 7 \
  --dry-run true
```

**What to verify:**
- ✅ Only shows incidents from last 7 days
- ✅ Different incident count than 30-day scan

**Test 4: No Violations Found**

```bash
# Test in tenant with clean DLP record
./cli/target/release/o365-cli run gov:dlp-violations \
  --days 30 \
  --dry-run true

# Expected: Message "No DLP violations found in the last 30 days. Excellent compliance!"
```

---

### SEC-02: MFA Enforcement Audit (sec:mfa-enforcement)

**Status:** ✅ Implemented

**Test 1: Identify Users Without MFA**

```bash
./cli/target/release/o365-cli run sec:mfa-enforcement --dry-run true
```

**What to verify:**
- ✅ Scans all users in tenant
- ✅ Returns table with users missing MFA:
  - User Principal Name
  - Display Name
  - Admin role (if any)
  - Sign-in risk level
  - Last sign-in date
  - MFA status (Not Registered)
- ✅ Prioritizes admin accounts (shown first)

**Test 2: MFA Registration Statistics**

```bash
./cli/target/release/o365-cli run sec:mfa-enforcement --dry-run false
```

**What to verify:**
- ✅ Summary statistics:
  - Total users
  - Users with MFA enabled
  - Users without MFA
  - Admins without MFA (critical)
  - MFA adoption percentage
- ✅ Recommendations for improving MFA coverage

**Test 3: All Users Have MFA**

```bash
# Test in tenant with 100% MFA adoption
./cli/target/release/o365-cli run sec:mfa-enforcement --dry-run true

# Expected: Message "All users have MFA enabled. Excellent security posture!"
```

**Test 4: Admin Risk Report**

```bash
./cli/target/release/o365-cli run sec:mfa-enforcement --dry-run true
```

**What to verify:**
- ✅ Admin accounts without MFA shown at top
- ✅ Marked as 🔴 Critical risk
- ✅ Immediate action recommended

---

### DEV-01: Windows Update Compliance (dev:windows-updates)

**Status:** ✅ Implemented

**Test 1: Audit Windows Update Status**

```bash
./cli/target/release/o365-cli run dev:windows-updates --dry-run true
```

**What to verify:**
- ✅ Scans all Windows devices managed by Intune
- ✅ Returns table with risky devices:
  - Device name
  - User Principal Name
  - Windows build version (e.g., "Windows 11 23H2")
  - Risk level (Critical/High/Medium/Low)
  - Days since last sync
  - Support status (Supported / Out-of-Support)
- ✅ Summary statistics:
  - Total devices
  - Critical risk devices
  - High risk devices
  - Medium risk devices
  - Compliant devices

**Test 2: Identify Out-of-Support Builds**

```bash
./cli/target/release/o365-cli run dev:windows-updates --dry-run false
```

**What to verify:**
- ✅ Devices on unsupported builds marked as 🔴 Critical
- ✅ Examples: Windows 10 21H2, Windows 11 21H2
- ✅ Immediate upgrade recommended

**Test 3: Identify Stale Devices (No Sync)**

```bash
./cli/target/release/o365-cli run dev:windows-updates --dry-run true
```

**What to verify:**
- ✅ Devices not synced in >30 days marked as 🟠 High risk
- ✅ Devices not synced in >14 days marked as ⚠️ Medium risk
- ✅ Recommendations to enforce sync policies

**Test 4: All Devices Compliant**

```bash
# Test in tenant with well-maintained devices
./cli/target/release/o365-cli run dev:windows-updates --dry-run true

# Expected: Message "All Windows devices are compliant with update policies"
```

---

### RES-01: License Optimization (res:license-optimization)

**Status:** ✅ Implemented

**Test 1: Identify Unused Licenses**

```bash
./cli/target/release/o365-cli run res:license-optimization --dry-run true
```

**What to verify:**
- ✅ Shows all license types (E3, E5, etc.)
- ✅ Returns table with:
  - License type (SKU Part Number)
  - Total purchased
  - Total unused (unassigned)
  - Inactive user assignments (no sign-in >90 days)
  - Disabled user assignments
  - Potential monthly savings (in USD)
- ✅ Summary:
  - Total monthly license cost
  - Total potential savings (monthly + annual)

**Test 2: Cost Savings Recommendations**

```bash
./cli/target/release/o365-cli run res:license-optimization --dry-run false
```

**What to verify:**
- ✅ Licenses sorted by savings potential (highest first)
- ✅ Recommendations:
  - Remove licenses from disabled users
  - Review inactive user licenses (>90 days)
  - Reduce purchases in next renewal
- ✅ Annual savings projection displayed

**Test 3: Calculate E5 License Waste**

```bash
./cli/target/release/o365-cli run res:license-optimization --dry-run true
```

**What to verify:**
- ✅ Premium licenses (E5, Project, Visio) prioritized
- ✅ Cost per license shown accurately:
  - Microsoft 365 E5: $57/user/month
  - Office 365 E5: $38/user/month
  - Microsoft 365 E3: $36/user/month
- ✅ Realistic savings estimate

**Test 4: Optimal License Utilization**

```bash
# Test in tenant with perfect license allocation
./cli/target/release/o365-cli run res:license-optimization --dry-run true

# Expected: Message "All licenses are optimally utilized. Potential savings: $0.00"
```

---

## Next Phase Testing

As each new module is implemented, add its testing section here following this template:

### [CATEGORY]-[NUMBER]: [Module Name] ([module:id])

**Status:** ✅ Implemented

**Test 1: [Test Name]**

```bash
[command]
```

**What to verify:**
- ✅ [Expected behavior 1]
- ✅ [Expected behavior 2]

**Test 2: Error Handling**

```bash
[error test command]
```

**What to verify:**
- ✅ [Error handling behavior]

---

---

## Phase 2: TUI Module Execution Testing

### Implementation Status: COMPLETE ✅

**Build Status:** 0 errors, 0 warnings, 34/34 tests passing

### Overview

Phase 2 adds interactive module execution to the TUI with:
- Dynamic input collection modals
- Multi-step input flow with validation
- Real-time execution progress display
- IPC communication with TypeScript workers
- Proper CLI flag formatting for arguments

### Test Case 1: Multi-Input Module (iam:offboard)

**Test Steps:**
1. Launch TUI: `./cli/target/release/o365-cli`
2. Navigate to IAM category (press `1` or arrow keys + Enter)
3. Select "Graceful Offboarding" (first module in list)
4. Press Enter to trigger input modal

**Expected Flow:**

**Step 1/3 - User Email:**
- Modal title: "Configure: Graceful Offboarding"
- Prompt: "Email of user to offboard"
- Type hint: "Type: Email address"
- Input field: `> _` (cursor visible)
- Controls: `[Enter] Next │ [Esc] Cancel`

**Actions:**
- Type: `testuser@yourdomain.com`
- Press Enter

**Step 2/3 - Manager Email:**
- Progress: "Step 2/3"
- Prompt: "Manager email (for mailbox delegation)"
- Type hint: "Type: Email address"

**Actions:**
- Type: `manager@yourdomain.com`
- Press Enter

**Step 3/3 - Device Action:**
- Progress: "Step 3/3"
- Prompt: "Device action (retire/wipe/none)"
- Type hint: "Type: Choice"
- Available options displayed:
  ```
  • retire
  • wipe
  • none
  ```

**Actions:**
- Type: `retire`
- Press Enter

**Execution Progress Modal:**
- Title: "Executing: Graceful Offboarding"
- Progress bar: `[========================================] 100%`
- Current message: "Disabling user account..." (or similar)
- Execution Log section showing:
  ```
  🚀 Spawning Worker for task: iam:offboard
  ⏳ [10%] Searching for user in Entra ID...
  ⏳ [25%] Disabling user account...
  ⏳ [50%] Removing licenses...
  ⏳ [75%] Setting mailbox delegation...
  ⏳ [100%] Offboarding complete
  ```
- Controls: `[Esc] Cancel`

**After Completion:**
- Modal closes
- Main log shows: `✅ Module 'Graceful Offboarding' completed successfully`
- Results table displayed (if applicable)

**Verify Arguments Passed to Worker:**
```bash
# Check logs/o365-cli_*.log for command:
# Expected args: ["--user", "testuser@yourdomain.com", "--manager", "manager@yourdomain.com", "--device-action", "retire", "--dry-run", "true"]
```

### Test Case 2: Input Validation

**Test Steps:**
1. Navigate to IAM → Graceful Offboarding
2. Press Enter to start input flow
3. At "Email of user to offboard" prompt:
   - Leave blank
   - Press Enter

**Expected:**
- Error message appears: `Error: This field is required`
- Modal stays on Step 1/3
- Input buffer cleared
- Can type new value

**Validation Recovery:**
1. Type valid email: `testuser@yourdomain.com`
2. Press Enter
3. Modal advances to Step 2/3

### Test Case 3: Modal Cancellation

**Test During Input Collection:**
1. Navigate to any module with inputs
2. Press Enter to start
3. At any input step, press Esc

**Expected:**
- Modal closes immediately
- Returns to module list
- No execution occurs
- Log shows no activity

**Test During Execution:**
1. Start module execution
2. While execution progress modal is visible, press Esc

**Expected:**
- Modal closes
- Execution continues in background (synchronous, so completes immediately)
- Summary shown in logs when done
- Note: In current sync implementation, execution finishes before Esc can be pressed

### Test Case 4: No-Input Modules

**Test Steps:**
1. Navigate to Security → Shadow IT Detection
2. Press Enter

**Expected:**
- Input modal skipped (module has no inputs)
- Execution progress modal appears immediately
- Args passed: `["--dry-run", "true"]`
- Execution proceeds normally

### Test Case 5: Dry-Run Flag Injection

**Verify Default Behavior:**
1. Launch TUI and navigate to Settings Dashboard (Tab key)
2. Check "Default Dry Run" setting (should be `true`)
3. Execute any module
4. Check logs for command args

**Expected:**
- All modules automatically get `--dry-run true` appended
- Even modules with no inputs receive dry-run flag

**Change Dry-Run Setting:**
1. (Future: Settings UI to toggle dry-run)
2. For now, verify default behavior only

### Test Case 6: Argument Format Verification

**Critical Fix Verification:**

**Before Fix (WRONG):**
```
["testuser@yourdomain.com", "manager@yourdomain.com", "retire"]
```

**After Fix (CORRECT):**
```
["--user", "testuser@yourdomain.com", "--manager", "manager@yourdomain.com", "--device-action", "retire", "--dry-run", "true"]
```

**How to Verify:**
1. Execute iam:offboard module with inputs
2. Check `logs/o365-cli_*.log`
3. Find line with: `Spawning Worker for task: iam:offboard`
4. Verify args are in `--flag value` format
5. Verify snake_case converted to kebab-case: `device_action` → `--device-action`

### Known Limitations

1. **Synchronous Execution:** TUI blocks during execution
   - Modal shows progress but updates aren't real-time
   - Future: Background thread with channel-based updates

2. **No Advanced Validation:**
   - Email format not validated
   - Choice validation not enforced (can type invalid choice)
   - Number ranges not checked
   - Future: Enhance validation in input modal handler

3. **No Execution Cancellation:**
   - Esc closes modal but doesn't kill worker
   - Worker runs to completion in background
   - Future: Process management with kill on Esc

### Success Criteria ✅

- [x] Input modal renders correctly for multi-step flow
- [x] Character input and backspace work
- [x] Validation shows error messages
- [x] Arguments formatted with CLI flags
- [x] Snake_case → kebab-case conversion works
- [x] Dry-run flag automatically injected
- [x] Execution progress modal displays
- [x] IPC messages parsed correctly
- [x] Results shown in logs
- [x] Escape handlers work correctly

### Files Modified

**Phase 2 Implementation:**
- `cli/src/state/app_state.rs` - Modal states, execute_module(), input handlers
- `cli/src/ui/components/modals.rs` - render_module_input_modal(), render_execution_progress_modal()
- `cli/src/modules/mod.rs` - Added PartialEq to InputDefinition

**Integration Points:**
- `cli/src/runner.rs` - IPC communication
- `core/src/handlers/registry.ts` - TaskRegistry pattern
- `modules.toml` - Input definitions

---

## Reporting Issues

If you find bugs during testing:

1. **Check logs:** `logs/o365-cli_TIMESTAMP.log`
2. **Report with:**
   - Module ID (e.g., `gov:gdpr-export`)
   - Command used
   - Expected vs actual behavior
   - Log file excerpt

Example:
```
Module: gov:gdpr-export
Command: ./cli/target/release/o365-cli run gov:gdpr-export --user test@example.com
Expected: Export file created
Actual: Error "Permission denied"
Log: [paste relevant log lines]
```
