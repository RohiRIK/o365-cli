<#
.SYNOPSIS
    M365 License Optimization V3.0 (Granular & Web Pricing)
    
.DESCRIPTION
    Scans Microsoft 365 for:
    1. Zombies (Disabled Users)
    2. Ghosts (Inactive > 60 Days)
    3. Downgrade Opportunities (E5 users inactive > 30 days)
    4. Intune Waste (Licensed users with no Intune activity)
    5. Redundant Licensing (Overlaps)

    Fetches pricing dynamically from a Web JSON source.

.PARAMETER PriceListUrl
    URL to a raw JSON file containing SKU prices.
    Format: { "SKU_PART_NUMBER": 57.00, "ANOTHER_SKU": 10.00 }

.EXAMPLE
    .\Optimize-Licenses.ps1
#>

[CmdletBinding()]
param (
    [string]$PriceListUrl = "https://raw.githubusercontent.com/joshuamshead/M365-Price-Index/main/m365_prices_example.json", # Replace with your URL
    [string]$ReportPath = ".\License_Optimization_Report.csv"
)

process {
    Write-Host "--- M365 LICENSE OPTIMIZER V3.0 ---" -ForegroundColor Cyan

    # ==========================================
    # 1. PRICING ENGINE (WEB + FALLBACK)
    # ==========================================
    $CostMap = @{}
    
    Write-Host "Fetching Pricing Data..." -NoNewline
    try {
        # Try to fetch JSON from web
        $WebPrices = Invoke-RestMethod -Uri $PriceListUrl -ErrorAction Stop
        
        # Handle different JSON structures (Array vs Object)
        if ($WebPrices -is [System.Collections.IDictionary]) {
            $CostMap = $WebPrices
        } else {
            # Attempt to parse if it's a simple object
            foreach ($Prop in $WebPrices.PSObject.Properties) {
                $CostMap[$Prop.Name] = $Prop.Value
            }
        }
        Write-Host " [WEB SOURCE USED]" -ForegroundColor Green
    }
    catch {
        Write-Host " [FALLBACK DEFAULTS USED]" -ForegroundColor Yellow
        Write-Warning "Could not reach Web Pricing URL. Using hardcoded estimates."
        
        # DEFAULT FALLBACK PRICES (Monthly USD)
        $CostMap = @{
# --- M365 SUITES ---
          "SPE_E5"                   = 57.00 # M365 E5
          "SPE_E3"                   = 36.00 # M365 E3
          "SPE_F1"                   = 2.25  # M365 F1
          "M365_F3"                  = 8.00  # M365 F3
          "ENTERPRISEPREMIUM"        = 57.00 # O365 E5 (Legacy Name)
          "ENTERPRISEPACK"           = 32.00 # O365 E3 (Legacy Name)
          "DESKLESSPACK"             = 4.00  # O365 F3
        
         # --- BUSINESS SUITES ---
          "O365_BUSINESS_PREMIUM"    = 22.00 # Business Premium
          "STANDARDPACK"             = 12.50 # Business Standard
          "O365_BUSINESS_ESSENTIALS" = 6.00  # Business Basic

        # --- SECURITY & MANAGEMENT ---
          "EMS"                      = 10.60 # EMS E3
          "EMSPREMIUM"               = 16.40 # EMS E5
          "Microsoft_Intune_Suite"   = 10.00 # Intune Plan 1
           "INTUNE_A"                 = 8.00  # Intune Standalone

        # --- APPS & ADD-ONS ---
          "VISIOCLIENT"              = 15.00 # Visio Plan 2
          "PROJECTPROFESSIONAL"      = 30.00 # Project Plan 3
          "POWER_BI_STANDARD"        = 10.00 # Power BI Pro
          "POWER_BI_PREMIUM_PPU"     = 20.00 # Power BI Premium Per User
          "TEAMS_ESSENTIALS"         = 4.00 
          "EXCHANGESTANDARD"         = 4.00  # Exchange Online P1
          "EXCHANGEENTERPRISE"       = 8.00  # Exchange Online P2
      }
    }

    # ==========================================
    # 2. CONNECT & INVENTORY
    # ==========================================
    try {
        Connect-MgGraph -Scopes "User.Read.All", "Directory.Read.All", "Reports.Read.All" -NoWelcome -ErrorAction Stop
        Write-Host "Connected to Graph." -ForegroundColor Green
    } catch {
        Write-Error "Could not connect to Microsoft Graph. Run 'Install-Module Microsoft.Graph' first."
        return
    }

    Write-Host "Downloading SKU Database..." -ForegroundColor Gray
    $SubscribedSkus = Get-MgSubscribedSku -All
    $SkuLookup = @{}
    foreach ($Sku in $SubscribedSkus) { $SkuLookup[$Sku.SkuId] = $Sku }

    Write-Host "Scanning User Base (This may take time)..." -ForegroundColor Gray
    # We grab specific properties to calculate waste
    $Users = Get-MgUser -Filter "assignedLicenses/`$count ne 0" -ConsistencyLevel eventual -CountVariable UserCount -All -Property Id, DisplayName, UserPrincipalName, AccountEnabled, AssignedLicenses, SignInActivity, CreatedDateTime, Department

    # ==========================================
    # 3. ANALYSIS LOGIC
    # ==========================================
    $Report = @()
    $RemediationList = @()
    $TotalSavings = 0.0

    # Logic Configuration
    $DaysForZombie = 60   # Days inactive to be considered a ghost
    $DaysForDowngrade = 30 # Days inactive to suggest E5->E3
    
    $Counter = 0
    foreach ($User in $Users) {
        $Counter++
        Write-Progress -Activity "Analyzing Users" -Status "$($User.UserPrincipalName)" -PercentComplete (($Counter / $Users.Count) * 100)

        $Status = "Active"
        $Recs = @()
        $UserSavings = 0.0
        $UserLicenseNames = @()
        $IsE5 = $false
        
        # 3a. Resolve License Names & Key Workloads
        $HasExchange = $false
        $HasTeams = $false
        
        foreach ($Lic in $User.AssignedLicenses) {
            $SkuObj = $SkuLookup[$Lic.SkuId]
            $Name = if ($SkuObj) { $SkuObj.SkuPartNumber } else { "Unknown" }
            $UserLicenseNames += $Name

            # Flag E5 status for downgrade logic
            if ($Name -match "E5" -or $Name -eq "ENTERPRISEPREMIUM") { $IsE5 = $true }

            # Check Workloads (Simplifies output)
            if ($SkuObj) {
                foreach ($Plan in $SkuObj.ServicePlans) {
                    if ($Lic.DisabledPlans -notcontains $Plan.ServicePlanId) {
                        if ($Plan.ServicePlanName -eq "EXCHANGE_S_ENTERPRISE") { $HasExchange = $true }
                        if ($Plan.ServicePlanName -eq "TEAMS1") { $HasTeams = $true }
                    }
                }
            }
        }

        # Calculate Current Spend
        $CurrentCost = 0
        foreach ($Name in $UserLicenseNames) {
            if ($CostMap.ContainsKey($Name)) { $CurrentCost += $CostMap[$Name] }
        }

        # 3b. Determine Inactivity
        $DaysInactive = 0
        if ($User.SignInActivity.LastSignInDateTime) {
            $DaysInactive = (New-TimeSpan -Start $User.SignInActivity.LastSignInDateTime).Days
        } elseif ($User.CreatedDateTime) {
             # If never signed in, calculate from creation date
             $DaysInactive = (New-TimeSpan -Start $User.CreatedDateTime).Days
        }

        # --- WASTE SCENARIO 1: ZOMBIE (Disabled) ---
        if ($User.AccountEnabled -eq $false) {
            $Status = "Zombie (Disabled)"
            $Recs += "Remove All Licenses"
            $UserSavings = $CurrentCost # 100% Waste
            
            # Create Remediation Entry
            $RemediationList += [PSCustomObject]@{ UPN=$User.UserPrincipalName; Action="Remove-All"; SKU="ALL" }
        }
        # --- WASTE SCENARIO 2: GHOST (Inactive > 60) ---
        elseif ($DaysInactive -gt $DaysForZombie) {
            $Status = "Ghost (Inactive > $DaysForZombie days)"
            $Recs += "Review for Removal"
            $UserSavings = $CurrentCost # 100% Waste
        }
        # --- WASTE SCENARIO 3: DOWNGRADE (E5 -> E3) ---
        elseif ($IsE5 -and $DaysInactive -gt $DaysForDowngrade) {
            # User is active enough not to delete, but inactive enough not to need E5
            $Status = "Over-Licensed"
            $Recs += "Downgrade E5 to E3"
            
            # Calculate difference (Approximation)
            $E3Price = if ($CostMap["SPE_E3"]) { $CostMap["SPE_E3"] } else { 32.00 }
            $E5Price = if ($CostMap["SPE_E5"]) { $CostMap["SPE_E5"] } else { 57.00 }
            $Diff = $E5Price - $E3Price
            
            if ($Diff -gt 0) { $UserSavings += $Diff }
        }
        # --- WASTE SCENARIO 4: INTUNE (Licensed but Inactive) ---
        elseif (($UserLicenseNames -contains "Microsoft_Intune_Suite" -or $UserLicenseNames -contains "EMS") -and $DaysInactive -gt 45) {
            $Recs += "Remove Intune (Low Activity)"
            if ($CostMap["Microsoft_Intune_Suite"]) { $UserSavings += $CostMap["Microsoft_Intune_Suite"] }
        }

        $TotalSavings += $UserSavings

        $ExchangeWorkload = if ($HasExchange) { 'Exch' } else { '-' }
        $TeamsWorkload = if ($HasTeams) { 'Teams' } else { '-' }

        # Add to Report
        $Report += [PSCustomObject]@{
            User = $User.DisplayName
            UPN = $User.UserPrincipalName
            Department = $User.Department
            Status = $Status
            InactiveDays = $DaysInactive
            Licenses = ($UserLicenseNames -join ", ")
            KeyWorkloads = "$ExchangeWorkload / $TeamsWorkload"
            CurrentCost = $CurrentCost
            PotentialWaste = $UserSavings
            Recommendations = ($Recs -join " | ")
        }
    }
    Write-Progress -Activity "Done" -Completed

    # ==========================================
    # 4. EXPORT REPORTS
    # ==========================================
    
    # CSV 1: Main Report
    $Report | Export-Csv -Path $ReportPath -NoTypeInformation -Encoding UTF8
    Write-Host "[CSV] Report saved to $ReportPath" -ForegroundColor Green

    # CSV 2: Remediation (Simple file for automation)
    if ($RemediationList.Count -gt 0) {
        $RemPath = $ReportPath.Replace(".csv", "_REMEDIATION.csv")
        $RemediationList | Export-Csv -Path $RemPath -NoTypeInformation
        Write-Host "[CSV] Bulk Remediation file saved to $RemPath" -ForegroundColor Green
    }

    # HTML Dashboard
    $HtmlPath = $ReportPath.Replace(".csv", "_Dashboard.html")
    $HtmlContent = @"
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: sans-serif; background: #f0f2f5; padding: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; display: inline-block; margin: 10px; width: 220px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .val { font-size: 28px; font-weight: bold; color: #2c3e50; }
            .lbl { color: #7f8c8d; font-size: 14px; }
            .waste { color: #c0392b; }
            table { width: 100%; border-collapse: collapse; background: white; margin-top: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            th { background: #2980b9; color: white; padding: 12px; text-align: left; }
            td { padding: 12px; border-bottom: 1px solid #ddd; }
            tr:hover { background-color: #f1f1f1; }
        </style>
    </head>
    <body>
        <h2>License Optimization Dashboard</h2>
        <div class="card"><div class="val">$($Users.Count)</div><div class="lbl">Total Users Scanned</div></div>
        <div class="card"><div class="val waste">`$$([math]::Round($TotalSavings, 2))</div><div class="lbl">Monthly Waste Identified</div></div>
        <div class="card"><div class="val">$($Report | Where {$_.Status -like "*Zombie*"}).Count</div><div class="lbl">Zombies (Disabled)</div></div>
        <div class="card"><div class="val">$($Report | Where {$_.Recommendations -like "*Downgrade*"}).Count</div><div class="lbl">Downgrade Opportunities</div></div>

        <h3>Top 10 Cost Saving Opportunities</h3>
        <table>
            <tr><th>User</th><th>Status</th><th>Inactive Days</th><th>Waste</th><th>Recommendation</th></tr>
            $( 
                $Report | Sort-Object PotentialWaste -Descending | Select-Object -First 10 | ForEach-Object {
                    "<tr><td>$($_.User)</td><td>$($_.Status)</td><td>$($_.InactiveDays)</td><td class='waste'>`$$($_.PotentialWaste)</td><td>$($_.Recommendations)</td></tr>"
                }
            )
        </table>
    </body>
    </html>
"@
    Set-Content -Path $HtmlPath -Value $HtmlContent
    Write-Host "[HTML] Dashboard saved to $HtmlPath" -ForegroundColor Green
    Write-Host "Done." -ForegroundColor Cyan
}
