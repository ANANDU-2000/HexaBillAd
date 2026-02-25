@echo off
REM ========================================
REM RENDER DATABASE FIX - Quick Launcher
REM Purpose: Launch the PowerShell fix script
REM Author: AI Assistant
REM Date: 2025-11-15
REM ========================================

echo.
echo ========================================
echo RENDER POSTGRESQL DATABASE FIX
echo ========================================
echo.
echo This script will fix the production database error:
echo   "The data is NULL at ordinal 4"
echo.
echo Press any key to continue, or close this window to cancel...
pause >nul

cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File ".\ApplyRenderDatabaseFix.ps1"

echo.
echo Press any key to exit...
pause >nul
