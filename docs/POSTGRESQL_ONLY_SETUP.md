# PostgreSQL-only setup (serious app)

This app supports **PostgreSQL only** for production. All code paths (Purchase, Product, Sale, every page) are written to work with PostgreSQL; migrations and schema are generated for Npgsql.

## 1. One-time: generate PostgreSQL migrations

Current migrations in the repo may be SQLite-generated. To use **PostgreSQL only**:

1. **Backup and clear existing migrations** (from repo root):
   ```powershell
   .\backend\HexaBill.Api\scripts\SwitchToPostgreSQLMigrations.ps1
   ```
   This backs up `Migrations` to `MigrationsSqliteBackup` and clears `Migrations`.

2. **Set your PostgreSQL connection** (replace password):
   ```powershell
   $env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=hexabill;Username=postgres;Password=YOUR_PASSWORD;Include Error Detail=true"
   ```

3. **Generate and apply migrations** (from repo root):
   ```powershell
   cd backend\HexaBill.Api
   dotnet ef migrations add InitialPostgreSQL
   dotnet ef database update
   ```

4. **Run the app** with the same connection (env or `appsettings.json`). The app will use PostgreSQL; Purchase, Product, Sale, Reports, Ledger, and every page use UTC and Npgsql-compatible code.

## 2. Run the app with PostgreSQL

- **Option A – Environment (recommended for production)**  
  Set `ConnectionStrings__DefaultConnection` to your PostgreSQL connection string (e.g. on Render, or in your host’s env).

- **Option B – appsettings**  
  In `appsettings.json` or `appsettings.Development.json`, set:
  ```json
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=hexabill;Username=postgres;Password=YOUR_PASSWORD;Include Error Detail=true"
  }
  ```

The app detects PostgreSQL when the connection string contains `Host=` or `Server=` and uses Npgsql. All pages (Purchase, Product, Sale, Customer Ledger, Sales Ledger, Reports, etc.) run against PostgreSQL.

## 3. Design-time factory

`DesignTimeDbContextFactory` is used by `dotnet ef migrations add`. It reads `ConnectionStrings__DefaultConnection` from the environment (or appsettings). If the value contains `Host=` or `Server=`, it uses **Npgsql**; otherwise SQLite. So:

- To generate **PostgreSQL** migrations: set the connection string to PostgreSQL before running `dotnet ef migrations add`.
- To generate SQLite migrations (legacy): set it to a SQLite path.

## 4. Labels and migrations

- **Migrations:** After switching, the only applied migrations should be the PostgreSQL set (e.g. `InitialPostgreSQL`). Old SQLite migrations remain in `MigrationsSqliteBackup` and are not applied.
- **Each page:** Purchase, Product, Sale, Customer Ledger, Sales Ledger, Reports, Expenses, Users, Settings, etc. use the same `AppDbContext` and Npgsql; no SQLite-specific logic on these pages.
- **UTC:** Date/time are stored and queried in UTC for PostgreSQL compatibility.

## 5. Verification

- Start the API with a PostgreSQL connection string.
- Check logs for: `PostgreSQL database configured` or `Using connection string from ... (PostgreSQL)`.
- Open Dashboard, Products, Purchases, POS, Customer Ledger, Sales Ledger, Reports and confirm data loads and saves correctly.
