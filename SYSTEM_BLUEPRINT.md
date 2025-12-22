# SYSTEM BLUEPRINT & ROADMAP: o365-cli

## 1. Executive Summary
This document serves as the master functional roadmap for the `o365-cli` platform. It bridges legacy PowerShell logic with a modern, hybrid Rust/TypeScript architecture while proactively defining new administrative modules for enterprise Microsoft 365 governance.

## 2. Strategic Pillars
The platform is organized into six core pillars, each addressing a critical domain of M365 administration.

### 2.1 IAM: Identity & Access Management
*Focus: Lifecycle management, guest governance, and identity security.*

### 2.2 SEC: Security
*Focus: Threat detection, shadow IT, and security posture enforcement.*

### 2.3 GOV: Governance & Compliance
*Focus: Audit forensics, risk detection, and regulatory compliance.*

### 2.4 END: Endpoint & Device Management
*Focus: Intune orchestration, device health, and endpoint security.*

### 2.5 RES: Resource Management
*Focus: License optimization and stale asset reclamation.*

### 2.6 REP: Reporting
*Focus: 360-degree forensics and executive-level activity summaries.*

## 3. Module Maturity Model
To facilitate ideation, modules are tracked through the following stages:
1. **DRAFT:** Initial concept and problem statement identified.
2. **TECH DESIGN:** Graph API endpoints, permissions, and IPC protocols defined.
3. **READY:** Approved for implementation.
4. **LIVE:** Fully implemented in the hybrid stack.

---

## 4. Module Definitions

### 4.1 IAM Pillar
- **Graceful Offboarding:** Standard user termination protocol.
    - *Legacy:* `legacy/01-IAM-GracefulOffboarding`
- **Guest User Cleanup:** Identifying and removing stale guest accounts.
    - *Legacy:* `legacy/01-IAM-GuestUserCleanup`
- **New User Onboarding:** Automated setup for new joiners.
    - *Legacy:* `legacy/01-IAM-NewUserOnboarding`
- **[CONCEPT] RBAC Auditor:** Review custom roles and assignment hygiene.
- **[CONCEPT] Conditional Access Optimizer:** Detect redundant or conflicting CA policies.
- **[CONCEPT] Service Principal Lifecycle:** Prune unused or expired service principals.

### 4.2 SEC Pillar
- **Shadow IT Governance:** Detecting and remediating risky OAuth applications.
    - *Legacy:* `legacy/02-SEC-ShadowITGovernance`
- **External Sharing Audit:** Reviewing SharePoint/OneDrive external links.
    - *Legacy:* `legacy/02-SEC-ExternalSharingAudit`
- **Mailbox Permissions Audit:** Forensic review of delegation and access.
    - *Legacy:* `legacy/02-SEC-MailboxPermissionsAudit`
- **Surgical Lockdown:** Rapid containment of compromised accounts.
    - *Legacy:* `legacy/02-SEC-SurgicalLockdown`
- **[CONCEPT] Unified Threat Containment:** Rapid block-listing across the tenant.
- **[CONCEPT] Secure Score Benchmarking:** Interactive tracking of security posture.
- **[CONCEPT] Data Exfiltration Detector:** Monitor for bulk downloads or unusual sharing.

### 4.3 GOV Pillar
- **[CONCEPT] Sign-in Forensic Analyzer:** Deep-dive into suspicious sign-in attempts.
- **[CONCEPT] Audit Log Proactive Monitor:** Real-time alerting for sensitive admin actions.
- **[CONCEPT] PII Discovery Engine:** Scanning public sites for PII patterns.

### 4.4 END Pillar
- **[CONCEPT] Configuration Drift Detector:** Ensure devices adhere to baseline policies.
- **[CONCEPT] App Deployment Orchestrator:** CLI-driven orchestration of Win32 deployments.
- **[CONCEPT] Autopilot Profile Auditor:** Review and optimize OOBE profiles.

### 4.5 RES Pillar
- **License Optimization:** Identifying unused or redundant licenses.
    - *Legacy:* `legacy/03-RES-LicenseOptimization`
- **Stale Device Cleanup:** Removing inactive or untrusted devices.
    - *Legacy:* `legacy/03-RES-StaleDeviceCleanup`
- **[CONCEPT] SharePoint Storage Optimizer:** Identify large, unused sites and old versions.
- **[CONCEPT] Mailbox Archive Manager:** Automate move of data to cheaper storage.
- **[CONCEPT] Power Platform Guard:** Monitor for shadow environments and unused flows.

### 4.6 REP Pillar
- **360° Offboarding Analyzer:** Comprehensive forensic report for departed users.
    - *Legacy:* `legacy/04-REP-360OffboardingAnalyzer`
- **Teams Activity Report:** Usage and engagement metrics for Microsoft Teams.
    - *Legacy:* `legacy/04-REP-TeamsActivityReport`
- **[CONCEPT] Executive Governance Dashboard:** High-level PDF/HTML report for C-suite.
- **[CONCEPT] Forensic Timeline Generator:** Build event maps for specific identities.
