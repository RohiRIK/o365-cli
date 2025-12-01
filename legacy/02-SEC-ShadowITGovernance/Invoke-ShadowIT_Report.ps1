<#
.SYNOPSIS
    Shadow IT Killer - Governance Tool for Microsoft Entra ID.
    Scans and remediates risky OAuth applications granted by users.

.DESCRIPTION
    This tool is designed for MSPs and IT Managers to detect "Shadow IT" - 
    third-party apps that users have connected to their corporate account 
    without approval.

    Features:
    - Whitelist for Verified Publishers and Specific App IDs.
    - Risk Scoring based on sensitive scopes (Mail.Read, Files.Read).
    - Auto-Remediation (Revoke) capability.
    - User Notification via Email.

.PARAMETER DryRun
    $true (Default): Audit mode only. No changes made.
    $false: Active mode. Will revoke permissions.

.PARAMETER NotifyUser
    $true: Sends an email to the user explaining why the app was removed.

.EXAMPLE
    .\Invoke-ShadowITCleanup.ps1 -DryRun $true
#>

[CmdletBinding()]
param (
    [bool]$DryRun = $true,
    [bool]$RemediationMode = $false,
    [bool]$NotifyUser = $false,
    [string]$ReportPath = ".\ShadowIT_Report.csv",
    
    # Apps allowed by default (Example: Zoom, Slack)
    [string[]]$AllowedAppIds = @(
        "2e6c0c2d-9488-4453-86c5-44223202534a", 
        "5e3ce6c0-2b1f-4285-8d4b-75ee78787346"  
    ),

    # Scopes that define an app as "Risky"
    [string[]]$HighRiskScopes = @(
        # Mail
        "Mail.Read", "Mail.ReadWrite", "Mail.Send",
        
        # Files & SharePoint
        "Files.Read", "Files.ReadWrite.All", "Files.Read.All",
        "Sites.ReadWrite.All", "Sites.Manage.All",

        # Directory & Users
        "User.ReadWrite.All", "Directory.ReadWrite.All",
        "Group.ReadWrite.All", "RoleManagement.ReadWrite.Directory",

        # Personal Data
        "Contacts.Read", "Contacts.ReadWrite",
        "Calendars.Read", "Calendars.ReadWrite",
        "Notes.Read.All"
    )
)

process {
    $Header = "--- Shadow IT Governance Tool (v1.2) ---"
    Write-Host $Header -ForegroundColor Cyan
    
    # 1. Connect to Graph
    try {
        $Scopes = @("DelegatedPermissionGrant.ReadWrite.All", "Application.Read.All", "User.Read.All", "Directory.Read.All", "AuditLog.Read.All")
        if ($NotifyUser) { $Scopes += "Mail.Send" }
        Connect-MgGraph -Scopes $Scopes -NoWelcome -ErrorAction Stop
        Write-Host "[V] Connected to Microsoft Graph" -ForegroundColor Green
    }
    catch {
        Write-Error "Connection Failed: $_"
        return
    }

    # 2. Scan Grants
    Write-Host "Scanning Tenant for OAuth Grants..." -ForegroundColor Yellow
    $AllGrants = Get-MgOauth2PermissionGrant -All
    $Report = @()

    foreach ($Grant in $AllGrants) {
        $SP = Get-MgServicePrincipal -ServicePrincipalId $Grant.ClientId -ErrorAction SilentlyContinue
        if (-not $SP) { continue }
        
        # --- FILTERS ---
        # Skip Microsoft Apps
        if ($SP.AppOwnerOrganizationId -eq "f8cdef31-a31e-4b4a-93e4-5f571e91255a") { continue }
        # Skip Whitelisted Apps
        if ($AllowedAppIds -contains $SP.AppId) { continue }

        # --- RISK CHECK ---
        $GrantScopes = $Grant.Scope -split " "
        $Risky = $GrantScopes | Where-Object { $HighRiskScopes -contains $_ }

        if ($Risky) {
            $UserUPN = "Unknown"
            $UserDisplayName = "Unknown"
            $AccountEnabled = $null
            $UserType = "N/A"
            $Department = "N/A"
            $JobTitle = "N/A"
            $ManagerEmail = "N/A"
            $LastSignIn = "N/A"

            if ([string]::IsNullOrEmpty($Grant.PrincipalId)) {
                # Case 1: Tenant-Wide Grant (Admin Consent)
                $UserUPN = "All Users (Admin Consent)"
                $UserDisplayName = "Organization Wide"
            }
            else {
                # Case 2: User-Specific Grant
                $User = Get-MgUser -UserId $Grant.PrincipalId -Property Id, DisplayName, UserPrincipalName, SignInActivity, Department, JobTitle, AccountEnabled, UserType -ErrorAction SilentlyContinue
                if ($User) {
                    $UserUPN = $User.UserPrincipalName
                    $UserDisplayName = $User.DisplayName
                    $AccountEnabled = $User.AccountEnabled
                    $UserType = $User.UserType
                    $Department = $User.Department
                    $JobTitle = $User.JobTitle
                    
                    if ($User.SignInActivity.LastSignInDateTime) {
                        $LastSignIn = $User.SignInActivity.LastSignInDateTime
                    }

                    # Fetch Manager
                    try {
                        $Manager = Get-MgUserManager -UserId $User.Id -ErrorAction SilentlyContinue
                        if ($Manager) { 
                            if ($Manager.AdditionalProperties.ContainsKey("mail")) { $ManagerEmail = $Manager.AdditionalProperties["mail"] }
                            elseif ($Manager.AdditionalProperties.ContainsKey("userPrincipalName")) { $ManagerEmail = $Manager.AdditionalProperties["userPrincipalName"] }
                        }
                    } catch {}
                }
            }

            Write-Host "(!) DETECTED: $($SP.DisplayName) on user $UserUPN" -ForegroundColor Red

            # --- DATA ENRICHMENT ---
            
            # 1. Secrets & Certificates Validity
            $SecretStatus = "None"
            if ($SP.PasswordCredentials) {
                $ValidSecrets = $SP.PasswordCredentials | Where-Object { $_.EndDateTime -gt (Get-Date) }
                $SecretStatus = if ($ValidSecrets) { "Valid ($($ValidSecrets.Count))" } else { "Expired" }
            }
            
            $CertStatus = "None"
            if ($SP.KeyCredentials) {
                $ValidCerts = $SP.KeyCredentials | Where-Object { $_.EndDateTime -gt (Get-Date) }
                $CertStatus = if ($ValidCerts) { "Valid ($($ValidCerts.Count))" } else { "Expired" }
            }

            # 3. App Details
            $Homepage = if ($SP.Homepage) { $SP.Homepage } else { "N/A" }
            $ReplyUrls = if ($SP.ReplyUrls) { $SP.ReplyUrls -join "; " } else { "N/A" }
            $VerifiedPublisher = if ($SP.VerifiedPublisher.DisplayName) { $SP.VerifiedPublisher.DisplayName } else { "Unverified" }

            # Add to Report
            $Report += [PSCustomObject]@{
                # --- METADATA ---
                DetectedDate     = (Get-Date).ToString("yyyy-MM-dd")
                Action           = if ($DryRun) { "Audit Only" } else { "Revoked" }

                # --- APPLICATION ---
                AppName          = $SP.DisplayName
                AppId            = $SP.AppId
                Publisher        = $SP.PublisherName
                VerifiedPub      = $VerifiedPublisher
                Homepage         = $Homepage
                ReplyUrls        = $ReplyUrls
                SignInAudience   = $SP.SignInAudience
                AppCreated       = $SP.CreatedDateTime
                SecretStatus     = $SecretStatus
                CertStatus       = $CertStatus
                
                # --- USER ---
                UserUPN          = $UserUPN
                UserDisplayName  = $UserDisplayName
                AccountEnabled   = $AccountEnabled
                UserType         = $UserType
                Department       = $Department
                JobTitle         = $JobTitle
                Manager          = $ManagerEmail
                LastSignIn       = $LastSignIn
                
                # --- PERMISSION GRANT ---
                GrantStart       = $Grant.StartTime
                GrantExpiry      = $Grant.ExpiryTime
                ConsentType      = $Grant.ConsentType
                RiskyScopes      = ($Risky -join ", ")
                AllScopes        = $Grant.Scope
            }
            
            # --- ACTION ---
            # Note: We skip remediation for 'All Users' grants in this tool as it's too risky to automate
            if (-not $DryRun -and $RemediationMode -and $Grant.PrincipalId) {
                try {
                    Remove-MgOauth2PermissionGrant -OAuth2PermissionGrantId $Grant.Id -ErrorAction Stop
                    Write-Host "    -> Permission Revoked." -ForegroundColor Green

                    if ($NotifyUser -and $User) {
                        # Simple Email Notification Logic
                        $Body = "Security Alert: We removed access for '$($SP.DisplayName)' due to security policy."
                        $Params = @{
                            UserId = $User.Id
                            Message = @{
                                Subject = "App Access Revoked: $($SP.DisplayName)"
                                Body = @{ ContentType = "Text"; Content = $Body }
                                ToRecipients = @(@{ EmailAddress = @{ Address = $User.UserPrincipalName } })
                            }
                        }
                        Send-MgUserMail @Params
                        Write-Host "    -> User Notified." -ForegroundColor Green
                    }
                }
                catch {
                    Write-Host "    -> Error revoking: $_" -ForegroundColor Red
                }
            }
        }
    }

    # 3. Output
    if ($Report.Count -gt 0) {
        $Report | Export-Csv -Path $ReportPath -NoTypeInformation -Encoding UTF8
        Write-Host "--- Scan Complete. Found $($Report.Count) risks. Report saved to: $ReportPath ---" -ForegroundColor Cyan
        # Preview
        $Report | Select-Object AppName, UserUPN, RiskyScopes, Manager | Format-Table -AutoSize
    } else {
        Write-Host "--- Scan Complete. No risks found. ---" -ForegroundColor Green
    }
    return $Report
}
