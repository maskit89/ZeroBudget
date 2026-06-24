<#
.SYNOPSIS
    One-time data migration: restore a dev .bak over the production database.
    Run ON THE VPS, in an elevated PowerShell.

.DESCRIPTION
    The production DB already exists (created empty + EF-migrated by the first
    deploy). This RESTORE ... WITH REPLACE overwrites it with your real dev data,
    relocating the data/log files into this instance's default data folder, then
    re-grants the app-pool login (the restored DB carries dev's users, not prod's).

    Uses System.Data.SqlClient over Shared Memory -- no sqlcmd/sqlpackage needed.
    Restoring an older backup onto a newer SQL Server (dev -> SQL 2025) is supported.

    Example:
        powershell -ExecutionPolicy Bypass -File .\Migrate-FromBak.ps1 -BakPath C:\deploy\incoming\ZeroBudget-migrate.bak
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string]$BakPath,
    [string]$SqlInstance = '.\SQLEXPRESS',
    [string]$Database    = 'ZeroBudget',
    [string]$ApiPool     = 'ZeroBudget-Api',
    [string]$AppLogin    = 'IIS APPPOOL\ZeroBudget-Api',
    [string]$HealthUrl   = 'http://127.0.0.1:5000/health'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Data
Import-Module WebAdministration
function Info($m) { Write-Host "==> $m" -ForegroundColor Cyan }

if (-not (Test-Path $BakPath)) { throw "Backup file not found: $BakPath" }
$masterCs = "Server=$SqlInstance;Database=master;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=30"

function Read-Sql([string]$query) {
    $cn = New-Object System.Data.SqlClient.SqlConnection; $cn.ConnectionString = $masterCs; $cn.Open()
    try {
        $cmd = $cn.CreateCommand(); $cmd.CommandText = $query; $cmd.CommandTimeout = 0
        $dt = New-Object System.Data.DataTable
        (New-Object System.Data.SqlClient.SqlDataAdapter $cmd).Fill($dt) | Out-Null
        return $dt
    } finally { $cn.Close() }
}

# --- 1. Stop the API so it releases its DB connections ----------------------
Info "Stopping app pool $ApiPool"
if ((Get-WebAppPoolState $ApiPool -ErrorAction SilentlyContinue).Value -eq 'Started') {
    Stop-WebAppPool $ApiPool; Start-Sleep -Seconds 3
}

# --- 2. Work out where to put the restored files + the backup's logical names
$dataDir = [string](Read-Sql "SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(4000)) AS p").Rows[0].p
if ([string]::IsNullOrWhiteSpace($dataDir)) {
    $master = [string](Read-Sql "SELECT physical_name FROM sys.master_files WHERE database_id=1 AND type=0").Rows[0].physical_name
    $dataDir = (Split-Path $master -Parent) + '\'
}
Info "Restoring into $dataDir"

$files = Read-Sql "RESTORE FILELISTONLY FROM DISK = N'$BakPath'"
$moves = foreach ($r in $files.Rows) {
    $leaf = Split-Path $r.PhysicalName -Leaf
    "MOVE N'{0}' TO N'{1}'" -f $r.LogicalName, (Join-Path $dataDir $leaf)
}

# --- 3. Single connection: drop connections, restore, re-grant --------------
$grant = @"
USE [$Database];
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$AppLogin')
    CREATE USER [$AppLogin] FOR LOGIN [$AppLogin];
ALTER ROLE [db_owner] ADD MEMBER [$AppLogin];
"@

$steps = @(
    "IF DB_ID('$Database') IS NOT NULL ALTER DATABASE [$Database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE",
    "RESTORE DATABASE [$Database] FROM DISK = N'$BakPath' WITH REPLACE, RECOVERY, $($moves -join ', ')",
    "ALTER DATABASE [$Database] SET MULTI_USER",
    $grant
)

$cn = New-Object System.Data.SqlClient.SqlConnection; $cn.ConnectionString = $masterCs; $cn.Open()
try {
    foreach ($s in $steps) {
        $cmd = $cn.CreateCommand(); $cmd.CommandText = $s; $cmd.CommandTimeout = 0
        Info ("Running: " + ($s -split "`n")[0].Trim())
        [void]$cmd.ExecuteNonQuery()
    }
} finally { $cn.Close() }

# --- 4. Restart the API and verify ------------------------------------------
Info "Starting app pool $ApiPool"
Start-WebAppPool $ApiPool

$rows = [int](Read-Sql "SELECT COUNT(*) AS c FROM [$Database].dbo.Transactions").Rows[0].c
Info "Transactions in restored DB: $rows"

Info "Health-checking $HealthUrl"
$ok = $false
for ($i = 1; $i -le 20; $i++) {
    try { if ((Invoke-WebRequest $HealthUrl -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) { $ok = $true; break } }
    catch { Start-Sleep -Seconds 3 }
}
if (-not $ok) { throw "Health check FAILED at $HealthUrl after restore." }

Write-Host "Data migration complete. The app is serving the restored data." -ForegroundColor Green
