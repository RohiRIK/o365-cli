# Research: Intune Configuration Assignments

## Goal
To retrieve a unified list of Intune policies and their group assignments.

## Graph API Endpoints

### 1. Device Configurations
- **List Policies:** `GET /deviceManagement/deviceConfigurations`
- **Get Assignments:** `GET /deviceManagement/deviceConfigurations/{id}/assignments`

### 2. Device Compliance Policies
- **List Policies:** `GET /deviceManagement/deviceCompliancePolicies`
- **Get Assignments:** `GET /deviceManagement/deviceCompliancePolicies/{id}/assignments`

### 3. Managed Apps (Mobile App Configurations)
- **List Apps:** `GET /deviceAppManagement/mobileApps`
- **Get Assignments:** `GET /deviceAppManagement/mobileApps/{id}/assignments`

## Implementation Strategy
1.  **Iterative Fetching:** Fetch all policies of a specific type.
2.  **Assignment Mapping:** For each policy, fetch its assignments.
3.  **Group Resolution:** Resolve `target.groupId` to actual Group Names using `GET /groups/{id}`.
4.  **Tabular Output:**
    | Policy Name | Type | Assigned To (Groups) | Last Modified |
    | :--- | :--- | :--- | :--- |
    | Win10 Endpoint Security | DeviceConfig | "All Users", "Finance-Laptops" | 2025-12-20 |
