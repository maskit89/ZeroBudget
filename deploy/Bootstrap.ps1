<#
.SYNOPSIS
    One-shot, idempotent bootstrap of a fresh Windows Server VPS for ZeroBudget.
    Bundles every server-side setup step into a single run.

.DESCRIPTION
    Performs, in order:
      1. IIS + URL Rewrite + ARR + .NET Hosting Bundle + OpenSSH + app pools/
         sites/firewall                                    (Setup-Server.ps1)
      2. SQL Server Express install (skipped if already present)
      3. Database create + app-pool grant                  (Setup-Database.sql)
      4. Production secrets file with an auto-generated JWT key
      5. Daily backup Scheduled Task                        (Register-BackupTask.ps1)

    Run ONCE in an ELEVATED PowerShell on the VPS, from the deploy folder:
        powershell -ExecutionPolicy Bypass -File .\Bootstrap.ps1

    Idempotent: re-running detects and skips completed steps, so if a step fails
    you can fix it and just run Bootstrap.ps1 again.

    No domain is required - the site binds to the server IP over HTTP. To add a
    domain + HTTPS later, re-run with -Domain "host" and run win-acme (wacs.exe).

    Afterwards it prints the only two things it cannot do for you: authorizing
    your SSH deploy key and adding the GitHub Actions secrets.
#>
[CmdletBinding()]
param(
    [string]$Domain      = '',                          # blank = IP-only / HTTP
    [string]$ApiRoot     = 'C:\inetpub\zerobudget\api',
    [string]$SqlInstance = '.\SQLEXPRESS',

    # SQL Server 2022 Express bootstrapper (small downloader). If this 404s, grab
    # the current link from https://www.microsoft.com/sql-server/sql-server-downloads
    # and pass it as -SqlInstallerUrl.
    [string]$SqlInstallerUrl = 'https://go.microsoft.com/fwlink/p/?linkid=2216019'
)

$ErrorActionPreference = 'Stop'
function Step($m) { Write-Host "`n===== $m =====" -ForegroundColor Cyan }

function Test-Sql {
    $old = $ErrorActionPreference; $ErrorActionPreference = 'SilentlyContinue'
    try   { sqlcmd -S $SqlInstance -E -b -Q 'SELECT 1' 1>$null 2>$null; return ($LASTEXITCODE -eq 0) }
    catch { return $false }
    finally { $ErrorActionPreference = $old }
}

# --- 1. IIS + modules + OpenSSH + pools/sites/firewall ----------------------
Step 'IIS, modules, OpenSSH, sites (Setup-Server.ps1)'
& "$PSScriptRoot\Setup-Server.ps1" -Domain $Domain -ApiRoot $ApiRoot

# --- 2. SQL Server Express --------------------------------------------------
Step 'SQL Server Express'
if (Test-Sql) {
    Write-Host "SQL instance '$SqlInstance' already reachable - skipping install."
} else {
    Write-Host 'Downloading and installing SQL Server Express (several minutes)...'
    $exe = Join-Path $env:TEMP 'SQL-Express-Setup.exe'
    Invoke-WebRequest -Uri $SqlInstallerUrl -OutFile $exe -UseBasicParsing
    # SSEI 'Install' downloads the media and installs a default SQLEXPRESS instance.
    Start-Process $exe -Wait -ArgumentList `
        '/ACTION=Install', '/QUIET', '/HIDEPROGRESSBAR', '/IACCEPTSQLSERVERLICENSETERMS'
    Remove-Item $exe -Force -ErrorAction SilentlyContinue
    if (-not (Test-Sql)) {
        throw "SQL Server Express is not reachable at '$SqlInstance' after install. " +
              'Install it manually (Basic install) and re-run Bootstrap.ps1 - completed steps are skipped.'
    }
    Write-Host 'SQL Server Express installed.'
}

# --- 3. Database + app-pool grant ------------------------------------------
Step 'Database + app-pool grant (Setup-Database.sql)'
sqlcmd -S $SqlInstance -E -b -i "$PSScriptRoot\Setup-Database.sql"
if ($LASTEXITCODE -ne 0) { throw "Setup-Database.sql failed (exit $LASTEXITCODE)." }

# --- 4. Production secrets file (generated once; never overwritten) ----------
Step 'Production secrets (appsettings.Production.json)'
New-Item -ItemType Directory -Force -Path $ApiRoot | Out-Null
$prod = Join-Path $ApiRoot 'appsettings.Production.json'
if (Test-Path $prod) {
    Write-Host "$prod already exists - leaving it untouched."
} else {
    $key  = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
    $conn = "Server=$SqlInstance;Database=ZeroBudget;Trusted_Connection=True;Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
    $cfg  = [ordered]@{
        ConnectionStrings = [ordered]@{ DefaultConnection = $conn }
        Jwt               = [ordered]@{ Key = $key }
    }
    ($cfg | ConvertTo-Json -Depth 5) | Set-Content -Path $prod -Encoding utf8
    Write-Host "Wrote $prod with a freshly generated JWT key."
}

# --- 5. Daily backup task ---------------------------------------------------
Step 'Daily backup task (Register-BackupTask.ps1)'
& "$PSScriptRoot\Register-BackupTask.ps1" -Server $SqlInstance

# --- Done -------------------------------------------------------------------
$ip = '<your-vps-ip>'
try { $ip = Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 5 } catch { }
Step 'Bootstrap complete'
Write-Host @"
The server is ready. Two things only YOU can finish:

1. Authorize your GitHub deploy key (after you generate it on your PC, copy the
   .pub here, then run):
     Add-Content C:\ProgramData\ssh\administrators_authorized_keys (Get-Content .\zerobudget_deploy.pub)
     icacls C:\ProgramData\ssh\administrators_authorized_keys /inheritance:r /grant "Administrators:F" /grant "SYSTEM:F"

2. Add these GitHub repo secrets (Settings -> Secrets and variables -> Actions):
     VPS_HOST      = $ip
     VPS_SSH_USER  = $env:USERNAME
     VPS_SSH_KEY   = <full contents of the PRIVATE key 'zerobudget_deploy'>
     VPS_SSH_PORT  = 22

Then merge PR #64 to trigger the first deploy. The app will be live at:
     http://$ip
"@ -ForegroundColor Green
