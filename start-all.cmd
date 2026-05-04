@echo off
cd /d "%~dp0"

title HR Agent System - Starting...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERR] Node.js not found. Please install Node.js 20+.
    echo        https://nodejs.org
    pause
    exit /b 1
)

echo [INFO] Starting HR Agent System...
echo.

node scripts\start-all.js
if %errorlevel% neq 0 (
    echo.
    echo [ERR] Startup failed. Check the error messages above.
)

pause
