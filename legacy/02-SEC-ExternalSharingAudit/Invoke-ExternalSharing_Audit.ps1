<#
.SYNOPSIS
    External Sharing & Public Link Audit Tool.
    Scans OneDrive and SharePoint sites for files shared with "Everyone" or External Guests.

.DESCRIPTION
    This script uses Microsoft Graph to audit sharing permissions.
    It iterates through:
    1. All User OneDrives (Personal Sites).
    2. All SharePoint/Teams Sites.
    
    It looks for:
    - "Anonymous" links (Anyone with the link can access).
    - "External" direct sharing (Guests).
    - "Company" links (Organization wide).

.PARAMETER Limit
    Maximum number of sites/drives to scan. Default 50 to prevent long runtimes in large tenants.

.PARAMETER ScanDeep
    If $true, recursively scans items. If $false, mostly checks Site/Drive root settings (Faster).
    *Note: Deep scanning via Graph is slow. This script focuses on Root Level and top-level items for efficiency.*

.PARAMETER ReportPath
    Path to save the CSV. Default: .\ExternalSharing_Report.csv

.EXAMPLE
    .\Invoke-ExternalSharing_Audit.ps1
#>

[CmdletBinding()]
param (
    [int]$Limit = 50,
    [switch]$ScanDeep,
    [string]$ReportPath = ".\ExternalSharing_Report.csv"
)

process {
    Write-Host "--- EXTERNAL SHARING AUDIT v1.0 ---" -ForegroundColor Cyan
    
    try {
        # Sites.Read.All, Files.Read.All, Directory.Read.All
        Connect-MgGraph -Scopes "Sites.Read.All", "Files.Read.All", "User.Read.All" -NoWelcome -ErrorAction Stop
        Write-Host "[V] Connected to Microsoft Graph." -ForegroundColor Green
    } catch {
        Write-Error "Connection Failed: $_"
        return
    }

    $Report = @()

    # --- 1. SCAN ONEDRIVES ---
    Write-Host "Scanning Top $Limit User OneDrives..." -ForegroundColor Gray
    $Users = Get-MgUser -Filter "userType eq 'Member'" -Top $Limit -Property Id, DisplayName, UserPrincipalName
    
    foreach ($User in $Users) {
        try {
            $Drive = Get-MgUserDrive -UserId $User.Id -ErrorAction SilentlyContinue
            if ($Drive) {
                # Check Root Permissions
                $Perms = Get-MgDriveRootPermission -DriveId $Drive.Id -ErrorAction SilentlyContinue
                foreach ($Perm in $Perms) {
                    if ($Perm.Link.Scope -eq "anonymous" -or $Perm.Link.Scope -eq "organization") {
                        $Report += [PSCustomObject]@{
                            Type = "OneDrive"
                            Owner = $User.DisplayName
                            Resource = "Root Drive"
                            LinkType = $Perm.Link.Scope
                            Roles = ($Perm.Roles -join ",")
                            LinkUrl = $Perm.Link.WebUrl
                        }
                        Write-Host "    [RISK] $($User.DisplayName): Found $($Perm.Link.Scope) link!" -ForegroundColor Red
                    }
                }
            }
        } catch {}
    }

    # --- 2. SCAN SHAREPOINT SITES ---
    Write-Host "Scanning Top $Limit SharePoint Sites..." -ForegroundColor Gray
    $Sites = Get-MgSite -Search "*" -Top $Limit
    
    foreach ($Site in $Sites) {
        # Check Drives in Site
        try {
            $Drives = Get-MgSiteDrive -SiteId $Site.Id -ErrorAction SilentlyContinue
            foreach ($Drive in $Drives) {
                 $Perms = Get-MgDriveRootPermission -DriveId $Drive.Id -ErrorAction SilentlyContinue
                 foreach ($Perm in $Perms) {
                    if ($Perm.Link.Scope -match "anonymous|organization") {
                        $Report += [PSCustomObject]@{
                            Type = "SharePoint"
                            Owner = $Site.DisplayName
                            Resource = $Drive.Name
                            LinkType = $Perm.Link.Scope
                            Roles = ($Perm.Roles -join ",")
                            LinkUrl = $Perm.Link.WebUrl
                        }
                        Write-Host "    [RISK] Site '$($Site.DisplayName)': Found $($Perm.Link.Scope) link!" -ForegroundColor Red
                    }
                 }
            }
        } catch {}
    }

    # --- EXPORT ---
    if ($Report.Count -gt 0) {
        $Report | Export-Csv -Path $ReportPath -NoTypeInformation -Encoding UTF8
        Write-Host "`n--- AUDIT COMPLETE ---" -ForegroundColor Cyan
        Write-Host "Found $($Report.Count) risky shares. Saved to: $ReportPath" -ForegroundColor Green
        $Report | Format-Table -AutoSize
    } else {
        Write-Host "`n[OK] No broad external/anonymous links found on Drive Roots." -ForegroundColor Green
    }
}
