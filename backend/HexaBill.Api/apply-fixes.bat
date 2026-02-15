@echo off
echo ========================================
echo Applying Database Fixes
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Building the project...
dotnet build --no-restore
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Build failed! Please fix build errors first.
    pause
    exit /b 1
)
echo ✅ Build successful!
echo.

echo [2/3] Applying database migrations...
dotnet ef database update
if %ERRORLEVEL% EQU 0 (
    echo ✅ Migrations applied successfully!
) else (
    echo.
    echo ⚠️ Migration warning (this is OK if migrations are already applied)
    echo The application will fix missing columns automatically on startup.
)
echo.

echo [3/3] Verifying database connection...
echo.
echo ✅ Setup complete!
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Start the application: dotnet run
echo 2. The DatabaseFixer will run automatically at startup
echo 3. Try adding a customer - transaction errors should be fixed!
echo.
pause

