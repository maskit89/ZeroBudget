# Production deployment — Windows Server (native IIS) runbook

ZeroBudget runs **natively on a Windows Server VPS** (no Docker):

| Tier | Host | Notes |
|------|------|-------|
| SPA (React `dist`) | IIS site **ZeroBudget** on :80/:443 | also reverse-proxies `/api` → the API |
| API (.NET 10) | IIS site **ZeroBudget-Api** on `localhost:5000`, hosted via the ASP.NET Core Module (ANCM) | IIS owns the process lifecycle |
| Database | **SQL Server Express** Windows service | data files on disk → survive every deploy |

```
Internet :443 ──► IIS "ZeroBudget" (SPA + URL Rewrite)
                      │  proxy ^api/(.*) ──► http://localhost:5000/api/{R:1}
                      ▼
                 IIS "ZeroBudget-Api" (ANCM) ──► SQL Server Express (Windows auth)
```

The React client already calls the same-origin `/api` prefix, so the proxy needs **no frontend changes** and there is **no CORS** in production.

---

## Files in this repo

| File | Runs where | Purpose |
|------|-----------|---------|
| `deploy/Setup-Server.ps1` | VPS, once | IIS + URL Rewrite + ARR + .NET Hosting Bundle + OpenSSH + app pools/sites + firewall |
| `deploy/Setup-Database.sql` | VPS, once | create DB (if absent) + grant the app-pool login `db_owner` |
| `deploy/web/web.config` | shipped to the SPA site | the `/api` reverse-proxy + SPA-fallback rewrite rules |
| `deploy/Deploy.ps1` | VPS, every deploy | `app_offline` swap + robocopy + pool recycle + `/health` smoke test |
| `deploy/Export-DevData.ps1` | dev machine, once | LocalDB → `.bacpac` |
| `deploy/Import-ToServer.ps1` | VPS, once | `.bacpac` → SQL Server |
| `deploy/Backup-Database.ps1` | VPS | timestamped `.bak` + retention pruning |
| `deploy/Register-BackupTask.ps1` | VPS, once | register the daily backup as a Scheduled Task (runs as SYSTEM) |
| `.github/workflows/deploy.yml` | GitHub Actions | build → SSH-push → deploy on merge to `main` |
| `src/ZeroBudget.Api/appsettings.Production.json.example` | template | copy to the server, fill in secrets (gitignored) |

---

## One-time server setup (manual)

> All commands run in an **elevated PowerShell** over RDP on the VPS.

### 1. Bootstrap IIS + tooling
```powershell
# From a copy of the repo's deploy/ folder (or just this script):
powershell -ExecutionPolicy Bypass -File .\Setup-Server.ps1 -Domain "budget.yourdomain.com"
```
Verify the **.NET 10 Hosting Bundle** URL in the script is the latest build before running (Microsoft bumps the patch version). After it finishes, `dotnet --list-runtimes` should show `Microsoft.AspNetCore.App 10.x`.

### 2. SQL Server
Install **SQL Server Express** (Basic install is fine). Then:
```powershell
sqlcmd -S .\SQLEXPRESS -E -i .\Setup-Database.sql
```

### 3. Server-only secrets
Copy the template into the API folder and fill it in — this file is **never** deployed over (robocopy `/XF`) and is gitignored:
```powershell
Copy-Item .\appsettings.Production.json.example C:\inetpub\zerobudget\api\appsettings.Production.json
notepad C:\inetpub\zerobudget\api\appsettings.Production.json
```
Generate a strong `Jwt:Key` (≥32 bytes):
```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 4. SSH deploy key
On your machine, create a keypair dedicated to deploys:
```bash
ssh-keygen -t ed25519 -f zerobudget_deploy -C "github-actions"
```
On the VPS, append the **public** key to the admin authorized-keys file (note the ACL step — required for admin accounts):
```powershell
Add-Content C:\ProgramData\ssh\administrators_authorized_keys (Get-Content .\zerobudget_deploy.pub)
icacls C:\ProgramData\ssh\administrators_authorized_keys /inheritance:r /grant "Administrators:F" /grant "SYSTEM:F"
```
Test from your machine: `ssh -i zerobudget_deploy Administrator@<vps-ip>`.

### 5. (Optional) migrate existing household data
On the **dev machine**:
```powershell
dotnet tool install -g microsoft.sqlpackage
powershell -File .\Export-DevData.ps1          # → deploy\ZeroBudget.bacpac
```
Copy `ZeroBudget.bacpac` to the VPS, then on the **VPS** (before step 2's grant, since import creates the DB):
```powershell
powershell -File .\Import-ToServer.ps1 -BacpacPath C:\deploy\ZeroBudget.bacpac
sqlcmd -S .\SQLEXPRESS -E -i .\Setup-Database.sql   # re-run to grant on the new DB
```

### 6. DNS + TLS
- Point a DNS **A record** at the VPS public IP.
- Install free Let's Encrypt TLS with **win-acme** (`wacs.exe`): pick the `ZeroBudget` site; it creates the 443 binding **and** offers to add the HTTP→HTTPS redirect, and schedules auto-renewal. (This is the IIS-native equivalent of Caddy's auto-HTTPS.)

---

## GitHub repo configuration (manual)

Add these **Actions secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `VPS_HOST` | VPS public IP or hostname |
| `VPS_SSH_USER` | e.g. `Administrator` |
| `VPS_SSH_KEY` | the **private** key from step 4 (full file contents) |
| `VPS_SSH_PORT` | `22` (or your custom SSH port) |

Recommended: **branch protection** on `main` requiring the existing `backend` / `frontend` / `a11y` CI checks, so only green code can merge and deploy. Optionally add a required reviewer on the `production` environment to gate the deploy job.

---

## The deploy flow (automatic)

1. You merge a PR into `main`.
2. `deploy.yml` builds the release on an Ubuntu runner: `dotnet publish` (win-x64) + `npm run build`, zipped as `release.zip` (`api/`, `web/`, `Deploy.ps1`).
3. `scp` copies the zip to `C:\deploy\incoming` on the VPS.
4. `ssh` extracts it to `C:\deploy\staging` and runs `Deploy.ps1`, which:
   - drops `app_offline.htm` (releases the API's file locks),
   - `robocopy /MIR`s the new files — **preserving** `appsettings.Production.json`, the offline marker, and the ANCM `logs` folder,
   - removes the marker, recycles both app pools,
   - polls `http://localhost:5000/health` until `200` (EF migrations run on first hit), failing the job otherwise.

**Data safety:** only the API/SPA file trees are replaced. The SQL Server database and its `.mdf`/`.ldf` files are never touched, so data persists across every deploy. EF Core migrations are additive/idempotent — they only apply *pending* schema changes and never drop data.

---

## Backups

After SQL Server is installed, register the daily backup (runs as SYSTEM, prunes to 14 days):
```powershell
powershell -ExecutionPolicy Bypass -File .\Register-BackupTask.ps1
# verify:  Start-ScheduledTask -TaskName ZeroBudget-DbBackup ; Get-ChildItem C:\deploy\backups
```
`.bak` files land in `C:\deploy\backups`. Run `Register-BackupTask.ps1` again to change the time/retention. If the task can't back up, the SYSTEM account lacks rights on the instance — grant it (or re-run the task as your SQL admin).

## Rollback

Re-run a previous successful **Deploy** workflow from the Actions tab (it re-pushes that commit's artifact), or check out the previous commit and `workflow_dispatch`. Take an ad-hoc backup before any deploy that includes a migration:
```powershell
powershell -File C:\deploy\Backup-Database.ps1
```
Restore a `.bak` if needed:
```powershell
sqlcmd -S .\SQLEXPRESS -E -Q "RESTORE DATABASE [ZeroBudget] FROM DISK='C:\deploy\backups\ZeroBudget_<stamp>.bak' WITH REPLACE"
```

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `500.19` / `500.30` on the API site | Hosting Bundle missing or installed **before** IIS — reinstall it, then `iisreset`. |
| `/api` returns 404 from the SPA site | ARR proxy not enabled at server level (re-run `Setup-Server.ps1`), or URL Rewrite missing. |
| API up but DB errors at startup | app-pool login not granted — re-run `Setup-Database.sql`; check the connection string instance name (`\SQLEXPRESS`). |
| Deploy fails on file-in-use | `app_offline.htm` step didn't take — confirm the app pool exists and ANCM is installed. |
| Health check times out | check ANCM stdout logs in `C:\inetpub\zerobudget\api\logs`. |
