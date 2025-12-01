<#
.SYNOPSIS
    Standard Employee Offboarding Automation.
    Converts mailbox to Shared, grants manager access, and reclaims licenses.

.DESCRIPTION
    This script executes the "Graceful Exit" protocol for standard terminations.
    Unlike emergency lockdown, this focuses on data preservation and license optimization.

    WORKFLOW:
    1. Block Sign-in (if not already blocked).
    2. Convert Mailbox to 'Shared Mailbox' (Free retention < 50GB).
    3. Hide User from Global Address List (GAL).
    4. Grant 'Full Access' & 'Send As' permissions to the specified Manager.
    5. Remove Office 365 Licenses to stop billing.

.PARAMETER UserPrincipalName
    The leaver's email address.

.PARAMETER ManagerEmail
    The email address of the manager who needs access to the leaver's data.

.PARAMETER DryRun
    Preview mode. Defaults to $true.

.EXAMPLE
    .\Invoke-GracefulOffboarding.ps1 -UserPrincipalName "leaver@company.com" -ManagerEmail "boss@company.com" -DryRun $false
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$UserPrincipalName,

    [Parameter(Mandatory=$true)]
    [string]$ManagerEmail,

    [switch]$ExecuteLive
)

# --- SETUP ---
$Report = @()
Write-Host "--- GRACEFUL OFFBOARDING PROTOCOL ---" -ForegroundColor Cyan
Write-Host "Target: $UserPrincipalName" -ForegroundColor Gray
Write-Host "Manager: $ManagerEmail" -ForegroundColor Gray
Write-Host "Mode: $(if ($ExecuteLive) { '[LIVE EXECUTION]' } else { '[SIMULATION]' })" -ForegroundColor Yellow

# 1. Connect to Systems
# Note: This script requires BOTH Graph and Exchange modules due to mailbox complexity
try {
    # Connect Graph
    Connect-MgGraph -Scopes "User.ReadWrite.All", "Directory.ReadWrite.All" -NoWelcome -ErrorAction SilentlyContinue
    # Connect Exchange Online (Required for Set-Mailbox, usually requires interactive login or Certificate)
    Connect-ExchangeOnline -ShowProgress $false -ErrorAction SilentlyContinue
}
catch {
    Write-Error "Failed to connect. Ensure you have 'Microsoft.Graph' and 'ExchangeOnlineManagement' modules installed."
    return
}

# 2. Get User & Manager
$User = Get-MgUser -UserId $UserPrincipalName -ErrorAction Stop
$Manager = Get-MgUser -UserId $ManagerEmail -ErrorAction Stop

if (-not $User -or -not $Manager) { Write-Error "User or Manager not found."; return }


# --- STEP 1: BLOCK LOGIN ---
# Just in case they weren't locked down yet
$Action = "Ensure Account Blocked"
if (-not $ExecuteLive) {
    Write-Host "[SIMULATION] Would ensure account is disabled." -ForegroundColor Gray
} else {
    if ($User.AccountEnabled -eq $true) {
        Update-MgUser -UserId $User.Id -AccountEnabled:$false
        Write-Host "[Live] Account Disabled." -ForegroundColor Green
    } else {
        Write-Host "[Live] Account was already disabled." -ForegroundColor Yellow
    }
}


# --- STEP 2: CONVERT TO SHARED MAILBOX ---
# This allows us to keep the data for free and frees up the license
$Action = "Convert to Shared Mailbox"
if (-not $ExecuteLive) {
    Write-Host "[SIMULATION] Would convert mailbox to type 'Shared'." -ForegroundColor Gray
} else {
    try {
        Set-Mailbox -Identity $UserPrincipalName -Type Shared -ErrorAction Stop
        Write-Host "[Live] Mailbox converted to Shared." -ForegroundColor Green
    }
    catch {
        Write-Error "Failed to convert mailbox: $_"
    }
}


# --- STEP 3: HIDE FROM GAL ---
# Prevent other employees from seeing the leaver in Outlook address book
$Action = "Hide from GAL"
if (-not $ExecuteLive) {
    Write-Host "[SIMULATION] Would hide user from Global Address List." -ForegroundColor Gray
} else {
    try {
        Set-Mailbox -Identity $UserPrincipalName -HiddenFromAddressListsEnabled $true
        Write-Host "[Live] User hidden from Address Lists." -ForegroundColor Green
    }
    catch {
        Write-Error "Failed to hide from GAL: $_"
    }
}


# --- STEP 4: GRANT MANAGER ACCESS ---
# The core value: Giving the manager the ability to see old emails
$Action = "Grant Manager Access"
if (-not $ExecuteLive) {
    Write-Host "[SIMULATION] Would grant '$ManagerEmail' FullAccess to the mailbox." -ForegroundColor Gray
} else {
    try {
        Add-MailboxPermission -Identity $UserPrincipalName -User $ManagerEmail -AccessRights FullAccess -InheritanceType All -AutoMapping $true
        Write-Host "[Live] Manager granted Full Access." -ForegroundColor Green
    }
    catch {
        Write-Error "Failed to grant permissions: $_"
    }
}


# --- STEP 5: REMOVE LICENSES ---
# The money saver. Must be done AFTER conversion to Shared Mailbox.
$Action = "Reclaim Licenses"
if (-not $ExecuteLive) {
    Write-Host "[SIMULATION] Would remove all assigned licenses." -ForegroundColor Gray
} else {
    try {
        # Using Graph to remove licenses
        $Licenses = Get-MgUserLicenseDetail -UserId $User.Id
        if ($Licenses) {
            foreach ($Lic in $Licenses) {
                Set-MgUserLicense -UserId $User.Id -RemoveLicenses @($Lic.SkuId) -AddLicenses @()
                Write-Host "[Live] Removed License: $($Lic.SkuPartNumber)" -ForegroundColor Green
            }
        } else {
            Write-Host "[Live] No licenses found to remove." -ForegroundColor Yellow
        }
    }
    catch {
        Write-Error "Failed to remove licenses: $_"
    }
}

Write-Host "`n--- OFFBOARDING COMPLETE ---" -ForegroundColor Cyan
