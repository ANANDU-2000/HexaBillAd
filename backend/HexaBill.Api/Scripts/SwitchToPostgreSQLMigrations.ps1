# Switch to PostgreSQL-only migrations.
# 1. Backs up current (SQLite) Migrations folder.
# 2. Removes old migration files so we can add a fresh InitialPostgreSQL migration.
# 3. You must set ConnectionStrings__DefaultConnection to your PostgreSQL connection and run:
#    dotnet ef migrations add InitialPostgreSQL
#    dotnet ef database update
# Run from repo root: .\backend\HexaBill.Api\Scripts\SwitchToPostgreSQLMigrations.ps1

$ErrorActionPreference = "Stop"
$apiDir = $PSScriptRoot + "\.."
$migrationsDir = Join-Path $apiDir "Migrations"
$backupDir = Join-Path $apiDir "MigrationsSqliteBackup"

if (-not (Test-Path $migrationsDir)) {
    Write-Host "Migrations folder not found. Nothing to do."
    exit 0
}

# Backup
if (Test-Path $backupDir) {
    Write-Host "MigrationsSqliteBackup already exists. Remove it first if you want to re-backup."
} else {
    Copy-Item -Path $migrationsDir -Destination $backupDir -Recurse
    Write-Host "Backed up Migrations to MigrationsSqliteBackup"
}

# Remove all files in Migrations so we can add a fresh initial migration for PostgreSQL
Get-ChildItem -Path $migrationsDir -File | Remove-Item -Force
Write-Host "Cleared Migrations folder (backup is in MigrationsSqliteBackup)."

Write-Host ""
Write-Host "Next steps (PostgreSQL must be running):"
Write-Host "  1. Set connection string (replace with your password):"
Write-Host '     $env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=hexabill;Username=postgres;Password=YOUR_PASSWORD"'
Write-Host "  2. From backend/HexaBill.Api:"
Write-Host "     dotnet ef migrations add InitialPostgreSQL"
Write-Host "     dotnet ef database update"
Write-Host "  3. Run the app with the same connection string (env or appsettings) to use PostgreSQL."
