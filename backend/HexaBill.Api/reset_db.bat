@echo off
taskkill /F /IM dotnet.exe >nul 2>&1
if exist hexabill.db del /F /Q hexabill.db
if exist hexabill.db-shm del /F /Q hexabill.db-shm
if exist hexabill.db-wal del /F /Q hexabill.db-wal
dotnet ef database update --verbose > deploy.log 2>&1
