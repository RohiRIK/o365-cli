# License Optimization & ROI Engine (RES-03)

## 🚀 Vision & Purpose
The **License Optimization & ROI Engine** is the financial controller for your Microsoft 365 estate. In the cloud, "Waste" is the default state. Users leave, projects end, but expensive E5 licenses ($57/mo) remain assigned forever.

This module shifts IT from a cost center to a value driver. It detects **Zombies** (paying for disabled users), **Ghosts** (active users who don't use the software), and **Bloat** (overlapping SKUs), providing a direct path to reducing the monthly Opex bill.

## 💎 Key Features & Capabilities

### 📉 Waste Detection Algorithms
*   **Zombie Hunter:** Identifies users with `AccountEnabled = $false` who still hold a paid license. (100% Waste).
*   **Ghost Detection:** Identifies "Active" users who haven't signed in or used workloads in >60 days.
*   **Feature-Level Usage Analysis:**
    *   *Downgrade Logic:* Detects users with **E5** licenses who *only* use **E1** features (e.g., Email/Teams only, no PowerBI/Voice usage). Recommends downgrading.
*   **Redundancy Checker:** Finds users with overlapping subscriptions (e.g., "E3" + "Exchange Online Plan 2" standalone).

### 💲 Financial Intelligence
*   **Dynamic Pricing:** Connects to a live web JSON feed (or internal rate card) to fetch current SKU pricing.
*   **ROI Calculator:** Generates a report showing "Potential Monthly Savings" and "Annualized Savings".
*   **Departmental Chargeback:** Breaks down costs and waste by `Department` or `CostCenter` for internal billing.

### 📊 Executive Dashboards
*   **HTML Generator:** Produces a clean, visual HTML dashboard summarizing the savings opportunities for C-Level review.
*   **Remediation File:** Outputs a machine-readable CSV (`_Remediation.csv`) that can be fed into an automation script to actually remove the licenses.

## 🛠️ Technical Architecture

### Prerequisites
*   **PowerShell 7+**
*   **Microsoft Graph API:** `User.Read.All`, `Reports.Read.All`, `Directory.Read.All`.

### Logic Flow
1.  **Fetch Pricing:** Load SKU Cost Map.
2.  **Inventory:** Get all Licensed Users.
3.  **Activity Check:** Query `SignInActivity` and Service Plan usage.
4.  **Compute:** Compare Usage vs. Entitlement vs. Account Status.
5.  **Report:** Export ROI data.

## 🔮 Future Roadmap (The "Massive" Vision)
*   **Auto-Right-Sizing:** A "Set and Forget" mode that automatically downgrades users from E5 to E3 if they haven't used E5 features (Voice, PowerBI Pro) in 90 days.
*   **Group-Based Licensing Audit:** Analyzes Entra ID Group assignments to find *which* group is assigning the wasteful license, enabling root-cause fixing.
*   **Multi-Tenant Aggregation:** For MSPs, aggregate waste reports across 50+ tenants into a single "Global Savings" dashboard.