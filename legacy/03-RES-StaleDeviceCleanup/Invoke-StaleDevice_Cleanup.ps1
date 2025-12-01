 <#
.SYNOPSIS
    Enterprise Device Cleanup Tool v2.0 (Registration Type Aware).
    
.DESCRIPTION
    Smart cleanup that considers the 'TrustType' (Registration Type).
    
    CRITICAL IMPROVEMENTS:
    1. TrustType Filtering: Distinguishes between 'AzureAd' (Cloud-only), 'Workplace' (BYOD/Registered), and 'ServerAd' (Hybrid).
    2. Hybrid Protection: By default, it SKIPS Hybrid Joined devices to prevent sync loops (Zombies).
    3. Autopilot Awareness: Checks for specific ZTDIDs (Zero Touch IDs) to avoid killing Autopilot records.

.PARAMETER TargetTrustType
    Which registration types to clean. 
    Options: 'AzureAd', 'Workplace' (BYOD), 'ServerAd' (Hybrid).
    Default: 'AzureAd', 'Workplace' (We explicitly exclude 'ServerAd' by default).

.EXAMPLE
    .\Invoke-StaleDeviceCleanup_v2.ps1 -TargetTrustType "Workplace" -DryRun $false
    * Cleans only stale BYOD devices (Personal devices registered to work) *
#>

[CmdletBinding()]
param (
    [int]$DaysInactive = 90,

    # Default: Clean Cloud-Only and BYOD. Leave Hybrid alone.
    [string[]]$TargetTrustType = @("AzureAd", "Workplace"), 
    [string]$ReportPath = ".\StaleDevices_Report.csv",
    [bool]$ExecuteLive = $false
)

process {
    $Report = @()
    $ThresholdDate = (Get-Date).AddDays(-$DaysInactive)
    $NewDeviceBufferDate = (Get-Date).AddDays(-30)

    Write-Host "--- SMART DEVICE CLEANUP v2.1 ---" -ForegroundColor Cyan
    Write-Host "Target Trust Types: $($TargetTrustType -join ', ')" -ForegroundColor Magenta
    Write-Host "Report Path: $ReportPath" -ForegroundColor Gray

    try {
        Connect-MgGraph -Scopes "Device.ReadWrite.All" -NoWelcome -ErrorAction Stop
    } catch { return }

    # Fetching TrustType is crucial here
    Write-Host "Scanning devices..." -ForegroundColor Gray
    $AllDevices = Get-MgDevice -All -Property Id, DisplayName, OperatingSystem, ApproximateLastSignInDateTime, CreatedDateTime, TrustType, ProfileType, PhysicalIds

    foreach ($Device in $AllDevices) {
        
        # --- FILTER 1: Registration Type (TrustType) ---
        if ($TargetTrustType -notcontains $Device.TrustType) {
            Write-Host "    [SKIP] TrustType Mismatch ($($Device.TrustType)): $($Device.DisplayName)" -ForegroundColor DarkGray
            continue
        }

        # --- FILTER 2: Autopilot Protection (Corrected) ---
        # We check PhysicalIds for "[ZTDId]" which indicates an Autopilot record.
        # Previous logic using ProfileType was too aggressive.
        $IsAutopilot = $false
        if ($Device.PhysicalIds) {
            foreach ($Id in $Device.PhysicalIds) {
                if ($Id -match "^\[ZTDId\]") { $IsAutopilot = $true; break }
            }
        }

        if ($IsAutopilot) {
            Write-Host "    [SKIP] Autopilot Record (ZTDId Found): $($Device.DisplayName)" -ForegroundColor Yellow
            continue
        }

        # --- LOGIC: Staleness Check ---
        $IsStale = $false
        $Reason = ""

        if ($Device.ApproximateLastSignInDateTime) {
            if ($Device.ApproximateLastSignInDateTime -lt $ThresholdDate) {
                $IsStale = $true
                $Reason = "Inactive ($($Device.TrustType)) since $($Device.ApproximateLastSignInDateTime)"
            } else {
                 Write-Host "    [OK] Active Device: $($Device.DisplayName) (Last Seen: $($Device.ApproximateLastSignInDateTime))" -ForegroundColor Gray
            }
        }
        elseif ($null -eq $Device.ApproximateLastSignInDateTime -and $Device.CreatedDateTime -lt $NewDeviceBufferDate) {
            $IsStale = $true
            $Reason = "Never signed in ($($Device.TrustType))"
        } else {
             Write-Host "    [OK] New/Active Device: $($Device.DisplayName)" -ForegroundColor Gray
        }

        # --- ACTION ---
        if ($IsStale) {
            $LogObject = [PSCustomObject]@{
                DeviceName  = $Device.DisplayName
                DeviceId    = $Device.Id
                TrustType   = $Device.TrustType # Here is the Registration Type
                OS          = $Device.OperatingSystem
                LastSeen    = $Device.ApproximateLastSignInDateTime
                CreatedDate = $Device.CreatedDateTime
                Status      = if ($ExecuteLive) { "Deleted" } else { "Pending" }
                Reason      = $Reason
            }
            $Report += $LogObject

            if (-not $ExecuteLive) {
                Write-Host "    [AUDIT] Found Stale ($($Device.TrustType)): $($Device.DisplayName) - $Reason" -ForegroundColor Yellow
            }
            else {
                try {
                    Remove-MgDevice -DeviceId $Device.Id -ErrorAction Stop
                    Write-Host "    [DELETE] Removed ($($Device.TrustType)): $($Device.DisplayName)" -ForegroundColor Red
                }
                catch {
                    Write-Host "    [ERROR] Failed to delete $($Device.DisplayName): $_" -ForegroundColor DarkRed
                }
            }
        }
    }
    
    # --- EXPORT ---
    if ($Report.Count -gt 0) {
        $Report | Export-Csv -Path $ReportPath -NoTypeInformation -Encoding UTF8
        Write-Host "`n[REPORT] Found $($Report.Count) stale devices. Saved to: $ReportPath" -ForegroundColor Green
        $Report | Select-Object DeviceName, TrustType, LastSeen, Status | Format-Table -AutoSize
    } else {
        Write-Host "`n[REPORT] No stale devices found." -ForegroundColor Green
    }

    return $Report
}
