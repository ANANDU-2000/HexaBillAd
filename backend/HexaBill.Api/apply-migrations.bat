@echo off
echo Applying database migrations...
cd /d "%~dp0"
dotnet ef database update
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Migrations applied successfully!
    echo.
    echo The database should now have all required columns.
    echo You can now start the application.
) else (
    echo.
    echo ❌ Migration failed. Check the error messages above.
    echo.
    echo Note: The application will attempt to fix missing columns automatically on startup.
    echo You can also run the application and it will apply migrations automatically.
)
pause

