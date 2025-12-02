# Resource & Reporting Research

## 1. License Optimization (RES-03)

### 🔍 Research Context
Optimizing licenses is about finding waste. The current script looks at "Assigned" vs "SignIn".

### 🛡️ Advanced Strategy: "Feature-Level Intelligence"
*   **Workload Activity:** Don't just check "Did they sign in?". Check "Did they use the expensive features?"
    *   User has **E5** ($57) but only reads Email? -> Downgrade to **E1/F3**.
    *   User has **Visio Plan 2** but hasn't opened a .vsdx file in 90 days? -> Remove.

### API Implementation Map
| Metric | Endpoint | Value |
| :--- | :--- | :--- |
| **Detail Usage** | `/reports/getOffice365ActiveUserDetail` | Shows last activity date per workload (Exchange, OneDrive, Teams). |
| **Sku Lookup** | `/subscribedSkus` | Get total available vs consumed units. |
| **Direct Assignment** | `/users/{id}/licenseDetails` | Differentiate between "Direct" and "Group" assignment. (Crucial for remediation: You can't remove a group-assigned license directly from the user). |

---

## 2. Stale Device Cleanup (RES-03-D)

### 🔍 Research Context
Deleting devices can break things. Deleting a Hybrid-Joined device breaks trust with On-Prem AD. Deleting an Autopilot device breaks re-deployment.

### 🛡️ Enhancement Strategy
*   **Intune Sync:** Before deleting from Entra ID, check the device status in Intune (`/deviceManagement/managedDevices`).
    *   If "Compliant", **DO NOT DELETE** (even if stale login in Entra).
*   **LAPS Recovery:** Before deleting a device, try to retrieve/backup its BitLocker key (`/informationProtection/bitlocker/recoveryKeys`) just in case.

### Risk Logic
1.  Is `trustType` == `ServerAd` (Hybrid)? -> **SKIP** (Report only).
2.  Is `profileType` == `ZeroTouch` (Autopilot)? -> **SKIP**.
3.  Is `approximateLastSignInDateTime` > 180 days? -> **MARK DELETE**.

---

## 3. 360° User Analyzer (REP-04)

### 🔍 Research Context
The "dossier" concept is powerful. It needs to be instantaneous.

### 🛡️ Enhancement Strategy
*   **Parallel Fetching:** Rust/Bun can fetch Licenses, Devices, Group Memberships, and Sign-ins in parallel (`Promise.all`).
*   **Insider Risk Indicators:**
    *   *Mass Download:* Check `/auditLogs/sharePoint` for "FileDownloaded" spikes.
    *   *Impossible Travel:* Check `/identityProtection/riskyUsers`.

### API Implementation Map
| Insight | Endpoint |
| :--- | :--- |
| **Risk Level** | `/identityProtection/riskyUsers/{id}` |
| **MFA Status** | `/reports/authenticationMethods/userRegistrationDetails/{id}` |
| **Owned Objects** | `/users/{id}/ownedDevices`, `/users/{id}/ownedObjects` |

---

## 4. Teams Sprawl Auditor (REP-04-T)

### 🔍 Research Context
Teams sprawl consumes storage and creates compliance blind spots.

### 🛡️ Enhancement Strategy
*   **SharePoint Storage:** A Team is just a Group with a Drive. We must check the storage used by the underlying SharePoint site.
*   **Lifecycle:** Detect "Orphaned" teams (No owner).

### API Implementation Map
| Metric | Endpoint |
| :--- | :--- |
| **Team List** | `/groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')` |
| **Activity** | `/reports/getTeamsTeamActivityDetail` |
| **Storage** | `/sites/{id}/usage` |
