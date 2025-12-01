<#
.SYNOPSIS
    Surgical Lockdown Tool for High-Risk Offboarding.
    Performs Identity Lockdown, Mobile Selective Wipe, and Endpoint Isolation.

.DESCRIPTION
    This script acts as a "Kill Switch" for a compromised or hostile user.
    It operates in layers to ensure immediate neutralization without destroying personal data.

    ACTIONS PERFORMED:
    1. Identity: Block Sign-in, Revoke Refresh Tokens, Scramble Password.
    2. Mobile (iOS/Android): Issues 'Retire' command (Removes corporate data only).
    3. Desktop (Windows): Issues 'Isolate' command via Microsoft Defender for Endpoint.

.PARAMETER UserPrincipalName
    The target user's email address (UPN).

.PARAMETER DryRun
    If $true (Default), the script scans resources and generates a report of planned actions.
    If $false, the script EXECUTES the lockdown actions immediately.

.PARAMETER IsolationComment
    Reason for isolation (audited in Defender logs). Default: "Security Lockdown Protocol".

.EXAMPLE
    .\Invoke-SurgicalLockdown.ps1 -UserPrincipalName "bad.actor@company.com" -DryRun $true
    * GENERATES A PREVIEW REPORT ONLY *

.EXAMPLE
    .\Invoke-SurgicalLockdown.ps1 -UserPrincipalName "bad.actor@company.com" -DryRun $false
    * EXECUTES LIVE LOCKDOWN *
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$UserPrincipalName,

    [switch]$ExecuteLive,

    [string]$IsolationComment = "Security Incident: Immediate Lockdown Protocol Initiated"
)

# DEBUG
Write-Host "DEBUG: ExecuteLive is [$ExecuteLive]" -ForegroundColor Magenta

# --- CONFIGURATION & SETUP ---
$Report = @()
$ScriptStatus = if ($ExecuteLive) { "[LIVE EXECUTION]" } else { "[SIMULATION]" }

Write-Host "--- STARTING SURGICAL LOCKDOWN $ScriptStatus ---" -ForegroundColor Cyan
Write-Host "Target User: $UserPrincipalName" -ForegroundColor Gray

# 1. Connect to Microsoft Graph
# Required Scopes:
# - User.ReadWrite.All (For block/reset)
# - Directory.AccessAsUser.All (High privilege to act as user for admin tasks)
# - DeviceManagementManagedDevices.ReadWrite.All (For Retire command)
# - DeviceManagementManagedDevices.PrivilegedOperations.All (For Isolate command)
try {
    $Scopes = @("User.ReadWrite.All", "Directory.AccessAsUser.All", "DeviceManagementManagedDevices.ReadWrite.All", "DeviceManagementManagedDevices.PrivilegedOperations.All")
    Connect-MgGraph -Scopes $Scopes -NoWelcome -ErrorAction Stop
}
catch {
    Write-Error "Failed to connect to Microsoft Graph. Verify permissions."
    return
}

# 2. Get User Object
try {
    $User = Get-MgUser -UserId $UserPrincipalName -ErrorAction Stop
}
catch {
    Write-Error "User $UserPrincipalName not found."
    return
}

# --- PHASE 1: IDENTITY LOCKDOWN ---
Write-Host "`n[PHASE 1] Identity Access Control..." -ForegroundColor Yellow

# A. Block Sign-In
$ActionName = "Block Account"
if (-not $ExecuteLive) {
    $Report += [PSCustomObject]@{ Phase="Identity"; Action=$ActionName; Target=$User.UserPrincipalName; Status="Pending (Simulation)" }
    Write-Host "    [Simulate] Would set AccountEnabled = False" -ForegroundColor Gray
}
else {
    try {
        Update-MgUser -UserId $User.Id -AccountEnabled:$false
        $Report += [PSCustomObject]@{ Phase="Identity"; Action=$ActionName; Target=$User.UserPrincipalName; Status="Executed" }
        Write-Host "    [Live] Account Blocked." -ForegroundColor Green
    }
    catch {
        Write-Error "    [Error] Failed to block account: $_"
    }
}

# B. Revoke Sessions
$ActionName = "Revoke Sessions"
if (-not $ExecuteLive) {
    $Report += [PSCustomObject]@{ Phase="Identity"; Action=$ActionName; Target=$User.UserPrincipalName; Status="Pending (Simulation)" }
    Write-Host "    [Simulate] Would revoke all refresh tokens (kick out of Teams/Outlook)" -ForegroundColor Gray
}
else {
    try {
        Revoke-MgUserSignInSession -UserId $User.Id
        $Report += [PSCustomObject]@{ Phase="Identity"; Action=$ActionName; Target=$User.UserPrincipalName; Status="Executed" }
        Write-Host "    [Live] Sessions Revoked." -ForegroundColor Green
    }
    catch { Write-Host "    [Error] $_" -ForegroundColor Red }
}

# C. Scramble Password
$ActionName = "Scramble Password"
if (-not $ExecuteLive) {
    $Report += [PSCustomObject]@{ Phase="Identity"; Action=$ActionName; Target=$User.UserPrincipalName; Status="Pending (Simulation)" }
    Write-Host "    [Simulate] Would reset password to random 64-char string" -ForegroundColor Gray
}
else {
    try {
        $RandomPass = -join ((33..126) | Get-Random -Count 64 | ForEach-Object {[char]$_})
        $PassProfile = @{ Password = $RandomPass; ForceChangePasswordNextSignIn = $true }
        Update-MgUser -UserId $User.Id -PasswordProfile $PassProfile
        $Report += [PSCustomObject]@{ Phase="Identity"; Action=$ActionName; Target=$User.UserPrincipalName; Status="Executed" }
        Write-Host "    [Live] Password Scrambled." -ForegroundColor Green
    }
    catch { Write-Host "    [Error] $_" -ForegroundColor Red }
}


# --- PHASE 2: MOBILE DEVICES (SELECTIVE WIPE) ---
Write-Host "`n[PHASE 2] Mobile Asset Protection (Retire)..." -ForegroundColor Yellow

$MobileDevices = Get-MgUserManagedDevice -UserId $User.Id | Where-Object { $_.OperatingSystem -in @("iOS", "Android") }

if ($MobileDevices) {
    foreach ($Dev in $MobileDevices) {
        $ActionName = "Retire Device (Selective Wipe)"
        $TargetInfo = "$($Dev.DeviceName) ($($Dev.OperatingSystem))"
        
        if (-not $ExecuteLive) {
            $Report += [PSCustomObject]@{ Phase="Mobile"; Action=$ActionName; Target=$TargetInfo; Status="Pending (Simulation)" }
            Write-Host "    [Simulate] Would execute RETIRE on $TargetInfo" -ForegroundColor Gray
        }
        else {
            try {
                # 'Retire' removes corporate data but keeps personal data intact (MAM/MDM friendly)
                Retire-MgDeviceManagementManagedDevice -ManagedDeviceId $Dev.Id
                $Report += [PSCustomObject]@{ Phase="Mobile"; Action=$ActionName; Target=$TargetInfo; Status="Command Sent" }
                Write-Host "    [Live] Retire command sent to $TargetInfo" -ForegroundColor Green
            }
            catch {
                Write-Error "    [Error] Failed to retire $TargetInfo : $_"
            }
        }
    }
}
else {
    Write-Host "    No mobile devices found." -ForegroundColor Gray
}


# --- PHASE 3: WINDOWS ENDPOINTS (ISOLATION) ---
Write-Host "`n[PHASE 3] Windows Endpoint Isolation (Defender)..." -ForegroundColor Yellow

$WindowsDevices = Get-MgUserManagedDevice -UserId $User.Id | Where-Object { $_.OperatingSystem -eq "Windows" }

if ($WindowsDevices) {
    foreach ($Dev in $WindowsDevices) {
        $ActionName = "Isolate Machine"
        $TargetInfo = "$($Dev.DeviceName)"
        
        if (-not $ExecuteLive) {
            $Report += [PSCustomObject]@{ Phase="Endpoint"; Action=$ActionName; Target=$TargetInfo; Status="Pending (Simulation)" }
            Write-Host "    [Simulate] Would execute ISOLATE on $TargetInfo via Defender" -ForegroundColor Gray
        }
        else {
            # Execution: Calling the Graph Action for WindowsDefenderScan (Isolate requires specific API call)
            # Note: Directly invoking the 'isolate' action via Graph Beta Endpoint
            $Uri = "https://graph.microsoft.com/beta/deviceManagement/managedDevices('$($Dev.Id)')/isolate"
            
            try {
                $Body = @{ isolationComment = $IsolationComment } | ConvertTo-Json
                Invoke-MgGraphRequest -Method POST -Uri $Uri -Body $Body -ContentType "application/json"
                
                $Report += [PSCustomObject]@{ Phase="Endpoint"; Action=$ActionName; Target=$TargetInfo; Status="Isolation Triggered" }
                Write-Host "    [Live] ISOLATION command triggered for $TargetInfo" -ForegroundColor Green
            }
            catch {
                Write-Host "    [Error] Failed to isolate $TargetInfo. Ensure MDE integration is active. Error: $_" -ForegroundColor Red
                $Report += [PSCustomObject]@{ Phase="Endpoint"; Action=$ActionName; Target=$TargetInfo; Status="Failed" }
            }
        }
    }
}
else {
    Write-Host "    No Windows devices found." -ForegroundColor Gray
}

# --- SUMMARY ---
Write-Host "`n--- OPERATION COMPLETE ---" -ForegroundColor Cyan

# Export Report
if ($Report.Count -gt 0) {
    $ReportPath = ".\SurgicalLockdown_Report.csv" # Default report path
    $Report | Export-Csv -Path $ReportPath -NoTypeInformation -Encoding UTF8
    Write-Host "`n[REPORT] Saved action log to: $ReportPath" -ForegroundColor Green
    $Report | Format-Table -AutoSize
} else {
    Write-Host "`n[REPORT] No actions logged." -ForegroundColor Green
}

return $Report
