# Specification: IAM - Graceful Offboarding Implementation

## 1. Overview
Implement the "Graceful Offboarding" module within the hybrid Rust/TypeScript architecture. This module provides a standard, secure, and automated protocol for terminating user access and securing associated devices (Intune/Defender/Entra).

## 2. Functional Requirements

### 2.1 Identity & Access Containment
- **Disable Account:** Set `accountEnabled` to `false`.
- **Revoke Sessions:** Trigger a global session revocation.
- **Hide from GAL:** Set `showInAddressList` to `false`.

### 2.2 Endpoint & Device Containment (Cross-Pillar)
- **Identify Devices:** Query for all devices where the target user is the `PrimaryUser` or `RegisteredOwner`.
- **Intune Action:** Trigger a "Retire" or "Wipe" command for all Intune-managed devices.
- **Entra ID Action:** Disable device objects associated with the user to prevent unauthorized token usage.
- **Defender Action:** (If applicable) Tag the device for "Offboarding" or trigger isolation via the security API.

### 2.3 Resource & License Reclamation
- **Direct License Removal:** Identify and remove all direct license assignments.
- **Group-Based License Reclamation:** Remove the user from ALL security and M365 groups to ensure group-based licenses are revoked.

### 2.4 Data Retention & Handoff
- **Shared Mailbox Conversion:** Convert the user's primary mailbox to a shared mailbox.
- **Manager Delegation:** 
    - Grant the specified manager `FullAccess` and `SendAs` permissions to the shared mailbox.
    - Grant the manager "Site Collection Administrator" rights to the user's personal OneDrive site.

## 3. Technical Requirements

### 3.1 TUI Workflow (Step-by-Step Wizard)
1. **Screen 1 (Target):** Input prompt for the Target User UPN.
2. **Screen 2 (Manager):** Input prompt for the Manager UPN (Optional).
3. **Screen 3 (Device Options):** Prompt to choose device action (Skip / Retire / Wipe).
4. **Screen 4 (Review):** Display summary including found devices.
5. **Screen 5 (Execute):** Progress dashboard.

### 3.2 Worker Logic (TypeScript)
- **Module ID:** `iam:offboard`
- **New API Endpoints:** 
    - `GET /deviceManagement/managedDevices?$filter=userPrincipalName eq '{upn}'`
    - `POST /deviceManagement/managedDevices/{id}/retire`
    - `PATCH /devices/{id}` (Disable Entra ID device)

## 4. Acceptance Criteria
- [ ] User identity is disabled and isolated.
- [ ] Managed devices are retired or disabled based on selection.
- [ ] Licenses are reclaimed and mailbox converted.
- [ ] "Dry-Run" correctly lists the devices that *would* be affected.
