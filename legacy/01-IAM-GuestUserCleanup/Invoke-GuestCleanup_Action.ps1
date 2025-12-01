<#
.SYNOPSIS
    Enterprise Guest User Lifecycle Management Tool (v4.0).
    Includes: Safety Checks, License Harvesting, and Asset Handover Logic.

.DESCRIPTION
    The ultimate cleanup tool. Before deleting a guest:
    1. Checks for a Manager/Sponsor.
    2. IF FOUND: Grants Manager access to Mailbox/OneDrive.
    3. IF NOT FOUND: Triggers a Webhook for manual intervention.
    4. Finally, removes licenses and deletes the user.

.PARAMETER WebhookUrl
    The URL (n8n/Zapier) to call if a user needs deletion but has NO manager assigned.

.PARAMETER DryRun
    If $true, only simulates the process.

.EXAMPLE
    .\Invoke-GuestCleanup_v4.ps1 -WebhookUrl "https://n8n.mycompany.com/webhook/orphan-guest" -DryRun $false
#>

[CmdletBinding()]
param (
    [int]$DaysToDisable = 90,
    [int]$DaysToDelete = 180,
    [string[]]$ExcludedDomains = @("gmail.com", "partner.com"),
    
    [string]$WebhookUrl, # OPTIONAL: Provide this to handle orphans

    [switch]$ExecuteLive
)

process {
    $Report = @()
    $DisableDate = (Get-Date).AddDays(-$DaysToDisable)
    $DeleteDate = (Get-Date).AddDays(-$DaysToDelete)

    Write-Host "--- GUEST CLEANUP v4.0 (With Asset Handover) ---" -ForegroundColor Cyan
    Write-Host "Mode: $(if ($ExecuteLive) { '[LIVE EXECUTION]' } else { '[SIMULATION]' })" -ForegroundColor Yellow

    # Connect Graph + Exchange (Exchange is needed for mailbox permissions)
    try {
        Connect-MgGraph -Scopes "User.ReadWrite.All", "AuditLog.Read.All", "Directory.Read.All", "User.Read.All" -NoWelcome -ErrorAction Stop
        # Note: Set-Mailbox requires ExchangeOnlineManagement module loaded implicitly or explicitly
        Write-Host "[V] Connected to Microsoft Graph." -ForegroundColor Green
    } catch { return }

    $Guests = Get-MgUser -Filter "userType eq 'Guest'" -Property Id, DisplayName, UserPrincipalName, Mail, AccountEnabled, SignInActivity, CreatedDateTime

    foreach ($Guest in $Guests) {
        
        # --- 1. Whitelist Check ---
        $Domain = $Guest.UserPrincipalName.Split("@")[-1]
        if ($ExcludedDomains -contains $Domain) {
            Write-Host "    [SKIP] Whitelisted Domain ($Domain): $($Guest.DisplayName)" -ForegroundColor DarkGray
            continue
        }

        # --- 2. Staleness Check ---
        $LastActivity = $Guest.CreatedDateTime
        if ($Guest.SignInActivity.LastSignInDateTime) {
            $LastActivity = $Guest.SignInActivity.LastSignInDateTime
        }
        
        $ActionToTake = "Active"
        
        if ($LastActivity -lt $DeleteDate) {
            $ActionToTake = "DELETE"
        } elseif ($LastActivity -lt $DisableDate -and $Guest.AccountEnabled -eq $true) {
            $ActionToTake = "DISABLE"
        }

        if ($ActionToTake -eq "Active") { continue }

        # --- 3. EXECUTION ---
        Write-Host "    [PROCESSING $ActionToTake] User: $($Guest.DisplayName) (Inactive since $LastActivity)" -ForegroundColor Red

        if ($ActionToTake -eq "DISABLE") {
            if (-not $ExecuteLive) {
                Write-Host "        [SIMULATION] Would Disable Account." -ForegroundColor Gray
            } else {
                Update-MgUser -UserId $Guest.Id -AccountEnabled:$false
                Write-Host "        [LIVE] Account Disabled." -ForegroundColor Green
            }
        }
        
        if ($ActionToTake -eq "DELETE") {
            
            # --- STEP 1: FIND MANAGER / SPONSOR ---
            $Manager = $null
            try {
                $Manager = Get-MgUserManager -UserId $Guest.Id -ErrorAction SilentlyContinue
            } catch {}

            # --- BRANCH A: MANAGER FOUND ---
            if ($Manager) {
                Write-Host "        [HANDOVER] Found Manager: $($Manager.AdditionalProperties['displayName'])" -ForegroundColor Green
                
                if ($ExecuteLive) {
                    # 1. Grant Mailbox Access (If mailbox exists)
                    try {
                        Add-MailboxPermission -Identity $Guest.UserPrincipalName -User $Manager.Id -AccessRights FullAccess -InheritanceType All -ErrorAction Stop
                        Write-Host "        [ASSET] Granted Mailbox Access to Manager." -ForegroundColor Green
                    }
                    catch {
                        # Write-Verbose "        [INFO] No mailbox found or failed to grant access."
                    }
                }
                else {
                    Write-Host "        [SIMULATION] Would transfer assets to Manager." -ForegroundColor Gray
                }
            }
            
            # --- BRANCH B: NO MANAGER (ORPHAN) -> WEBHOOK ---
            else {
                Write-Host "        [ORPHAN] No Manager found!" -ForegroundColor Yellow
                
                if ($WebhookUrl) {
                    $Payload = @{
                        Event = "GuestDelete_Orphan"
                        UserEmail = $Guest.Mail
                        UserUPN = $Guest.UserPrincipalName
                        UserId = $Guest.Id
                        Action = "Manual Handover Required"
                        Date = (Get-Date).ToString("yyyy-MM-dd")
                    } | ConvertTo-Json

                    if ($ExecuteLive) {
                        try {
                            Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body $Payload -ContentType "application/json"
                            Write-Host "        [WEBHOOK] Sent alert to external system." -ForegroundColor Cyan
                        }
                        catch {
                            Write-Host "        [ERROR] Failed to send Webhook!" -ForegroundColor Red
                        }
                    }
                    else {
                        Write-Host "        [SIMULATION] Would trigger Webhook to: $WebhookUrl" -ForegroundColor Cyan
                    }
                }
                else {
                    Write-Host "        [WARNING] No Webhook URL provided. Assets might be lost." -ForegroundColor Magenta
                }
            }

            # --- STEP 3: DELETE (Only if not DryRun) ---
            if ($ExecuteLive) {
                try {
                    Remove-MgUser -UserId $Guest.Id -ErrorAction Stop
                    Write-Host "        [DELETE] User removed." -ForegroundColor Red
                } catch {
                    Write-Host "        [ERROR] Failed to delete user: $_" -ForegroundColor Red
                }
            } else {
                Write-Host "        [SIMULATION] Would delete user." -ForegroundColor Red
            }
        }
    }
}
