# How to Run HexaBill Backend

## Prerequisites

You need **.NET 9 SDK** to run the backend.

## Installation Steps

### Step 1: Install .NET 9 SDK

1. **Download .NET 9 SDK:**
   - Visit: https://dotnet.microsoft.com/download/dotnet/9.0
   - Download the **.NET 9 SDK** (not just Runtime)
   - Choose the Windows x64 installer

2. **Install:**
   - Run the downloaded installer
   - Follow the installation wizard
   - Make sure to check "Add to PATH" if prompted

3. **Verify Installation:**
   ```powershell
   dotnet --version
   ```
   Should show: `9.0.x` or similar

### Step 2: Restart Terminal/IDE

After installing .NET SDK, **restart**:
- Your terminal/PowerShell
- Your IDE (Cursor/VS Code)
- This ensures PATH is updated

### Step 3: Run Backend

```powershell
# Navigate to backend
cd backend/HexaBill.Api

# Restore packages (first time only)
dotnet restore

# Run the backend
dotnet run
```

The backend will start on: **http://localhost:5001** (or port shown in console)

## Alternative: Use Visual Studio

If you have Visual Studio installed:

1. Open `Billing_App-main.sln` in Visual Studio
2. Right-click `HexaBill.Api` project → Set as Startup Project
3. Press **F5** to run

## Database Setup

**Production uses PostgreSQL.** Schema changes are applied via EF Core migrations only.

### Install EF Core tools (one-time)

```powershell
dotnet tool install --global dotnet-ef
```

### Run migrations (PostgreSQL)

1. **Stop the running API** (e.g. stop `HexaBill.Api` or the terminal where `dotnet run` is running). Migrations need to run while the app is not using the DB.
2. From the backend folder:
   ```powershell
   cd backend/HexaBill.Api
   dotnet ef database update
   ```
   Uses the connection string from environment or `appsettings.json`.
3. Optional enterprise tables: `psql -d your_db -f Scripts/01_COMPLETE_DATABASE_SETUP.sql`

## Troubleshooting

### "dotnet is not recognized"
- .NET SDK is not installed or not in PATH
- Restart terminal after installation
- Check: `where.exe dotnet` should show path

### Port already in use
- Change port in `appsettings.json` or `launchSettings.json`
- Or stop the process using port 5001

### Database errors
- Delete `hexabill.db` file to reset
- Or run migrations: `dotnet ef database update`

## Default Login Credentials

After backend starts, you can login with:
- **Super Admin:** admin@hexabill.com / Admin123!
- **Tenant 1:** owner1@hexabill.com / Owner1@123
- **Tenant 2:** owner2@hexabill.com / Owner2@123
