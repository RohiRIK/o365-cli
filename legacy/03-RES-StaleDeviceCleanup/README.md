# Smart Stale Device Sanitizer (RES-03-D)

## 🚀 Vision & Purpose
The **Smart Stale Device Sanitizer** is the hygiene engine for your Entra ID device inventory. Stale devices are not just clutter—they are a **security risk** (unpatched endpoints) and a **reporting nightmare** (skewing compliance stats).

This module uses "Surgical Precision" to remove old devices without accidentally deleting active assets (like Autopilot records or Hybrid Joined machines), ensuring a clean, accurate directory.

## 💎 Key Features & Capabilities

### 🧠 Intelligent Filtering
*   **Registration Type Awareness (TrustType):**
    *   **Cloud-Only (AzureAd):** Safe to delete.
    *   **BYOD (Workplace):** Safe to delete (Unregister).
    *   **Hybrid Joined (ServerAd):** **PROTECTED.** This tool skips them by default to prevent "Sync Loops" (where on-prem AD just re-syncs the deleted device back to the cloud).
*   **Autopilot Safety:** Explicitly checks for `ZTDId` (Zero Touch Deployment ID) to protect pre-provisioned Autopilot records that may appear inactive but are actually just waiting in a box.

### 🕒 Staleness Logic
*   **Inactivity Timer:** Flags devices inactive >90 days (Configurable).
*   **Ghost Device Check:** Flags devices created >30 days ago that have *never* signed in (failed enrollments).

### 🛡️ Operational Safety
*   **Audit Mode (Dry Run):** Default behavior. Logs what *would* happen without touching data.
*   **CSV Logging:** Creates a forensic record of every deleted device ID, Name, and Owner before deletion.

## 🛠️ Technical Architecture

### Prerequisites
*   **PowerShell 7+**
*   **Microsoft Graph API:** `Device.ReadWrite.All`, `Device.Read.All`

### Parameters
*   `TargetTrustType`: Filter scope (e.g., `AzureAd`, `Workplace`).
*   `DaysInactive`: Threshold.
*   `ExcludeHybrid`: Boolean to force protection of on-prem synced devices.

## 🔮 Future Roadmap (The "Massive" Vision)
*   **Intune Cleanup Sync:** Automatically trigger a cleanup in Intune/Endpoint Manager for the same device ID to keep both directories in sync.
*   **Certificate Expiry Check:** Before deleting, check if the device's MDM certificate is expired (a sure sign of death).
*   **Lost/Stolen Verification:** API check against Intune to ensure the device isn't marked as "Lost" or "Stolen" (which might require evidence preservation instead of deletion).
*   **User Notification:** Email the device owner: *"We haven't seen your iPad in 90 days. We are removing it from corporate access."*