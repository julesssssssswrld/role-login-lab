@echo off
title Kill Role-Login-Lab Server
color 0C
echo ========================================
echo   Role-Based Login Lab - Stop Server
echo ========================================
echo.
echo Stopping any Node.js process on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Killing PID %%a
    taskkill /PID %%a /F
)
echo.
echo Server stopped. Press any key to close.
echo ========================================
pause