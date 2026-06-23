/*
    ZeroBudget — database + app-pool login bootstrap (idempotent).

    Run AFTER installing SQL Server Express, e.g.:
        sqlcmd -S .\SQLEXPRESS -E -i Setup-Database.sql

    Grants the IIS app-pool identity (IIS APPPOOL\ZeroBudget-Api) db_owner on the
    ZeroBudget database, so the API can connect with Trusted_Connection (no stored
    password) AND apply EF Core migrations (DDL) on startup.

    NOTE on data migration: if you are restoring household data from the dev
    machine, run Import-ToServer.ps1 FIRST (the BACPAC import creates the database),
    then run this script — the CREATE DATABASE below is skipped if it already exists,
    and only the login/grant is (re)applied.
*/

IF DB_ID(N'ZeroBudget') IS NULL
BEGIN
    PRINT 'Creating database ZeroBudget...';
    CREATE DATABASE [ZeroBudget];
END
ELSE
    PRINT 'Database ZeroBudget already exists — leaving data intact.';
GO

USE [master];
GO
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'IIS APPPOOL\ZeroBudget-Api')
BEGIN
    PRINT 'Creating login for IIS APPPOOL\ZeroBudget-Api...';
    CREATE LOGIN [IIS APPPOOL\ZeroBudget-Api] FROM WINDOWS;
END
GO

USE [ZeroBudget];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'IIS APPPOOL\ZeroBudget-Api')
BEGIN
    PRINT 'Creating database user for the app-pool login...';
    CREATE USER [IIS APPPOOL\ZeroBudget-Api] FOR LOGIN [IIS APPPOOL\ZeroBudget-Api];
END
GO

-- db_owner is required because EF Core migrations run DDL under this identity.
ALTER ROLE [db_owner] ADD MEMBER [IIS APPPOOL\ZeroBudget-Api];
GO

PRINT 'Setup-Database.sql complete.';
GO
