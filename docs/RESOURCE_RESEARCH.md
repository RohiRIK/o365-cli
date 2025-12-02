# Resource & Reporting Research & Enhancement Plan

## 1. License Optimization (RES-03)

### ⚙️ API Implementation Specifications

#### **A. User Detail Report**
*   **Endpoint:** `GET /reports/getOffice365ActiveUserDetail(period='D90')`
*   **Best Practice:**
    *   **Privacy:** Tenant settings might obfuscate names (showing standard IDs instead of UPNs).
    *   **Check:** Check `/admin/serviceAnnouncement/healthOverviews` or report settings. If data is anonymized, this report is useless for optimization.
    *   **Fallback:** Iterate users via `/users?$select=signInActivity` (slower but gets UPNs).

#### **B. Sku Utilization**
*   **Endpoint:** `GET /subscribedSkus`
*   **Best Practice:**
    *   **Calculation:** `consumption = consumedUnits / prepaidUnits`.
    *   **Alerting:** Flag if `consumption > 90%` (Run out soon) or `consumption < 50%` (Over-purchased).

#### **C. Service Plan Inspection**
*   **Endpoint:** `GET /users/{id}?$select=assignedLicenses`
*   **Logic:**
    *   Get `subscribedSkus` to map `skuId` -> `skuPartNumber` (e.g., "SPE_E5").
    *   Inspect `disabledPlans` inside `assignedLicenses`.
    *   **Optimization:** If a user has E5 but has `PowerBI_Pro` disabled in the plan, they aren't using the full value.

---

## 2. Stale Device Cleanup (RES-03-D)

### ⚙️ API Implementation Specifications

#### **A. Device Listing**
*   **Endpoint:** `GET /devices?$select=id,displayName,approximateLastSignInDateTime,trustType,profileType`
*   **Best Practice:**
    *   **Filtering:** Use server-side filtering: `$filter=approximateLastSignInDateTime lt 2023-01-01T00:00:00Z` (Graph supports this on `devices`).
    *   **Optimization:** Fetching only stale devices reduces payload size drastically.

#### **B. Autopilot Safety Check**
*   **Property:** `physicalIds` list contains `[ZTDId]...`
*   **Best Practice:**
    *   **Must Check:** BEFORE DELETE, iterate `physicalIds`. If ANY entry starts with `[ZTDId]`, abort delete.
    *   **Reason:** Deleting an Autopilot ID breaks the hardware hash binding; the device cannot re-provision cleanly.

---

## 3. 360° User Analyzer (REP-04)

### ⚙️ API Implementation Specifications

#### **A. Parallel Data Fetching**
*   **Strategy:** Use `Promise.all` (TypeScript) to fire 5 requests simultaneously per user.
    1.  User Info: `GET /users/{id}`
    2.  Auth Methods: `GET /users/{id}/authentication/methods` (Check for MFA)
    3.  Devices: `GET /users/{id}/ownedDevices`
    4.  App Roles: `GET /users/{id}/appRoleAssignments`
    5.  Groups: `GET /users/{id}/transitiveMemberOf`
*   **Best Practice:**
    *   **Batching:** For high volume, use `$batch` endpoint (up to 20 requests per HTTP call).
    *   **Throttling:** Monitor `429 Too Many Requests`. Graph throttles aggressive parallel fetches. Implement `Retry-After` header handling.

#### **B. Insider Risk Indicators**
*   **Endpoint:** `GET /auditLogs/signIns`
*   **Filter:** `userId eq '{id}' and status/errorCode eq 0`
*   **Logic:**
    *   **Geovelocity:** Compare `location` of last 5 sign-ins. If distance > 500 miles in < 2 hours -> Warning.
    *   **Time:** Check `createdDateTime`. 80% of sign-ins outside 08:00-19:00 local time -> Warning.

---

## 4. Teams Sprawl Auditor (REP-04-T)

### ⚙️ API Implementation Specifications

#### **A. Team Discovery**
*   **Endpoint:** `GET /groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')`
*   **Best Practice:**
    *   **Select:** `$select=id,displayName,renewedDateTime,createdDateTime`.
    *   **Expiration:** Check `renewedDateTime`. If older than 365 days, the Group Expiration Policy might delete it soon.

#### **B. Storage Usage**
*   **Endpoint:** `GET /sites/{groupId}/usage`
*   **Best Practice:**
    *   **Error Handling:** Not all Teams have a Site (provisioning delay). Handle `404` on site lookup.
    *   **Metric:** `storage/used` vs `storage/quota`.

#### **C. Channel Activity**
*   **Endpoint:** `GET /teams/{id}/channels`
*   **Best Practice:**
    *   **Empty Teams:** If `channels.length == 1` (just "General") AND no messages in General, mark as "Zombie".
    *   **Message Count:** `GET /teams/{id}/channels/{id}/messages/$count` (ConsistencyLevel: eventual).