@echo off
title Role-Login-Lab Server
color 0A
echo ========================================
echo   Role-Based Login Lab - Server Start
echo ========================================
echo.
echo Starting server on http://localhost:3000
echo Login page: http://localhost:3000/login.html
echo.
echo Press CTRL+C to stop the server.
echo ========================================
echo.
node server.js
pause