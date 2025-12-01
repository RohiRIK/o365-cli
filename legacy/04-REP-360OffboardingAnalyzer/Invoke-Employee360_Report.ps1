<#
.SYNOPSIS
    360° Employee Offboarding Analyzer.
    Generates a forensic report including: Activity, Licenses, Devices, and Group Memberships.
#>

[CmdletBinding()]
param (
    [int]$DaysToDisable = 60,      
    [int]$DaysToDecommission = 90, 
    [int]$DaysToDelete = 365,      
    [string[]]$ExcludedUPNs = @("ceo@yourdomain.com"), 
    [string]$ReportPath = ".\360_Offboarding_Report.csv",
    [int]$ThrottleLimit = 10  # Control Parallelism
)

process {
    # Thread-safe collection for parallel processing
    $Report = [System.Collections.Concurrent.ConcurrentBag[PSCustomObject]]::new()
    
    $DateDisable = (Get-Date).AddDays(-$DaysToDisable)
    $DateDecom = (Get-Date).AddDays(-$DaysToDecommission)
    $DateDelete = (Get-Date).AddDays(-$DaysToDelete)

    Write-Host "--- 360° OFFBOARDING ANALYZER v1.5 (Parallel) ---" -ForegroundColor Cyan
    
    # 1. Connect (Scope must include Device.Read.All and Directory.Read.All)
    # This initial connection is for Get-MgUser (which is outside the parallel loop)
    try {
        $Scopes = @("User.Read.All", "AuditLog.Read.All", "Directory.Read.All", "Device.Read.All", "GroupMember.Read.All", "User.ReadBasic.All") # Added User.ReadBasic.All for manager
        Connect-MgGraph -Scopes $Scopes -NoWelcome -ErrorAction Stop
        Write-Host "[V] Connected to Graph (main thread)." -ForegroundColor Green
    } catch { 
        Write-Error "Failed to connect to Microsoft Graph in main thread: $_"
        return 
    }

    # 2. Scan Users
    Write-Host "Scanning users and gathering intelligence (Parallel)..." -ForegroundColor Gray
    
    # We fetch basic properties first (this runs in the main thread)
    $AllUsers = Get-MgUser -All -Property Id, DisplayName, UserPrincipalName, AccountEnabled, SignInActivity, CreatedDateTime, OnPremisesSyncEnabled, AssignedLicenses, Department, JobTitle, LastPasswordChangeDateTime, UserType

    $AllUsers | ForEach-Object {
        # The Graph Context established in the main thread should be sufficient for sequential execution.
        # No need to check for or reconnect to MgGraph within each iteration of a sequential loop.
        # If the main connection fails, the script will terminate early.
        
        # --- FILTERS ---
        if ($_.OnPremisesSyncEnabled) { return }
        if ($ExcludedUPNs -contains $_.UserPrincipalName) { return }
        
        # Admin Check
        $IsAdmin = $false
        $Roles = Get-MgUserMemberOf -UserId $_.Id | Where-Object { $_.AdditionalProperties["@odata.type"] -eq "#microsoft.graph.directoryRole" }
        if ($Roles) { $IsAdmin = $true }

        # --- DATA GATHERING ---

        # A. Activity
        $LastSignInDate = $null
        $DaysInactive = 0
        $LoginStatus = "Never Signed In"

        if ($_.SignInActivity -and $_.SignInActivity.LastSignInDateTime) {
            $LastSignInDate = [datetime]$_.SignInActivity.LastSignInDateTime
            $DaysInactive = (New-TimeSpan -Start $LastSignInDate -End (Get-Date)).Days
            $LoginStatus = $LastSignInDate.ToString("yyyy-MM-dd")
        } else {
            $DaysInactive = (New-TimeSpan -Start $_.CreatedDateTime -End (Get-Date)).Days
        }

        # B. Licenses
        $LicenseString = "None"
        if ($_.AssignedLicenses) {
            $LicenseString = ($_.AssignedLicenses.SkuPartNumber) -join "; "
        }

        # C. DEVICES
        $DeviceList = "None"
        $DeviceCount = 0
        try {
            $UserDevices = Get-MgUserOwnedDevice -UserId $_.Id -Property DisplayName, OperatingSystem, ApproximateLastSignInDateTime -ErrorAction SilentlyContinue
            if ($UserDevices) {
                $DeviceCount = $UserDevices.Count
                $DeviceList = ($UserDevices | ForEach-Object { "$($_.DisplayName) ($($_.OperatingSystem))" }) -join "; "
            }
        } catch { $DeviceList = "Error fetching devices" }

        # D. GROUPS
        $GroupList = "None"
        try {
            $UserGroups = Get-MgUserMemberOf -UserId $_.Id | Where-Object { $_.AdditionalProperties["@odata.type"] -eq "#microsoft.graph.group" } -ErrorAction SilentlyContinue
            if ($UserGroups) {
                $GroupList = ($UserGroups.AdditionalProperties['displayName']) -join "; "
            }
        } catch { $GroupList = "Error fetching groups" }

        # E. MANAGER (New Feature!)
        $ManagerEmail = "N/A"
        try {
            $Manager = Get-MgUserManager -UserId $_.Id -ErrorAction SilentlyContinue
            if ($Manager) {
                if ($Manager.AdditionalProperties.ContainsKey("mail")) { $ManagerEmail = $Manager.AdditionalProperties["mail"] }
                elseif ($Manager.AdditionalProperties.ContainsKey("userPrincipalName")) { $ManagerEmail = $Manager.AdditionalProperties["userPrincipalName"] }
            }
        } catch { $ManagerEmail = "Error fetching manager" }


        # --- INSIGHTS & RECOMMENDATIONS ---
        $Recs = @()
        
        # 1. CRITICAL SECURITY: Dormant Admin
        if ($IsAdmin -and $DaysInactive -gt 30) { 
            $Recs += "[CRITICAL] Dormant Admin (Inactive > 30 days)" 
        }

        # 2. SECURITY: Stale Guest
        if ($_.UserType -eq 'Guest' -and $DaysInactive -gt 90) {
            $Recs += "[SECURITY] Stale Guest Account (Inactive > 90 days)"
        }

        # 3. RISK: Orphaned Account (Internal user with no manager)
        if ($_.UserType -ne 'Guest' -and $ManagerEmail -eq "N/A" -and $_.AccountEnabled -eq $true) {
            $Recs += "[RISK] Orphaned Account (No Manager Assigned)"
        }

        # 4. GOVERNANCE: Group Hoarder
        if ($UserGroups.Count -gt 50) {
            $Recs += "[GOVERNANCE] Excessive Group Membership (>$($UserGroups.Count) groups)"
        }

        # 5. COST: License Waste
        if ($_.AssignedLicenses.Count -gt 0 -and $DaysInactive -gt 60) {
            $Recs += "[COST] License Waste (Licensed & Inactive > 60 days)"
        }

        # 6. SECURITY: Stale Password
        if ($_.LastPasswordChangeDateTime -and $_.LastPasswordChangeDateTime -lt (Get-Date).AddDays(-365)) { 
            $Recs += "[SECURITY] Stale Password (>1yr old)" 
        }

        # 7. BASIC: Revoke Access (General inactive users)
        if ($DaysInactive -gt 180) { 
            $Recs += "[CLEANUP] Revoke Access (Inactive > 6mo)" 
        }
        
        $RecsString = $Recs -join "; "

        # --- PHASE DETERMINATION ---
        $Phase = "Active"
        $EffectiveDate = if ($LastSignInDate) { $LastSignInDate } else { $_.CreatedDateTime }

        if ($_.AccountEnabled -eq $true -and $EffectiveDate -lt $DateDisable) {
            # User is enabled but inactive for a while -> Suggest DISABLE
            $Phase = "DISABLE"
        }
        elseif ($_.AccountEnabled -eq $false -and $EffectiveDate -lt $DateDecom -and $EffectiveDate -ge $DateDelete) {
            # User is disabled, inactive for more than $DaysToDisable but less than $DaysToDelete
            # This implies they were already disabled and now need decommissioning
            $Phase = "DECOMMISSION"
        }
        if ($_.AccountEnabled -eq $false -and $EffectiveDate -lt $DateDelete) {
            # User is disabled and very inactive -> Suggest DELETE
            $Phase = "DELETE"
        }

        # FILTER: Only skip if Active AND No Recommendations
        # This ensures "Active" users with risks (e.g. Orphaned Account) are included in the report
        # if ($Phase -eq "Active" -and $Recs.Count -eq 0) { return } - REMOVED per user request to "output all"

        $JobTitle = if ($_.JobTitle) { $_.JobTitle } else { "N/A" }
        $Dept     = if ($_.Department) { $_.Department } else { "N/A" }

        # --- BUILD REPORT OBJECT ---
        $LogObject = [PSCustomObject]@{
            User            = $_.DisplayName
            UPN             = $_.UserPrincipalName
            JobTitle        = $JobTitle
            Department      = $Dept
            Manager         = $ManagerEmail
            DaysInactive    = $DaysInactive
            Phase           = $Phase
            Licenses        = $LicenseString
            Devices         = $DeviceList
            Groups          = $GroupList
            AccountStatus   = if ($_.AccountEnabled) { "Enabled" } else { "Disabled" }
            Recommendations = $RecsString
        }

        # Thread-safe add
        $Report.Add($LogObject)
        
        # Console output from threads can be messy, so we keep it minimal or use Write-Host (which PS handles reasonably well)
        if ($Phase -ne "Active" -or $Recs.Count -gt 0) {
             Write-Host "[$Phase] Found: $($_.DisplayName) | JobTitle: $JobTitle | Department: $Dept | Recs: $($Recs.Count)" -ForegroundColor Cyan
        }
    }

    # --- EXPORT ---
    if ($Report.Count -gt 0) {
        # Convert ConcurrentBag to array for export
        $FinalReport = $Report.ToArray() | Sort-Object DaysInactive -Descending
        
        $FinalReport | Export-Csv -Path $ReportPath -NoTypeInformation -Encoding UTF8
        Write-Host "`n[REPORT] Found $($Report.Count) users in scope. Saved to: $ReportPath" -ForegroundColor Green
        
        # Preview
        $FinalReport | Select-Object User, Phase, Licenses, Devices, Manager, Recommendations | Format-Table -AutoSize
    } else {
        Write-Host "No users found." -ForegroundColor Green
    }
}
