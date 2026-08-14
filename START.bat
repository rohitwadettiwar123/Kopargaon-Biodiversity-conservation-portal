@echo off
title Kopargaon Biodiversity Portal
color 0A
cls

echo.
echo  ===================================================
echo    Kopargaon Biodiversity Conservation Portal
echo    Starting server...
echo  ===================================================
echo.

:: Kill any process already using port 3000
echo  [*] Clearing port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000 "') do taskkill /F /PID %%a >nul 2>&1

:: Check if node_modules exist
if not exist "node_modules\" (
    echo  [*] Installing dependencies...
    npm install
    echo.
)

:: Check if database exists
if not exist "backend\database.sqlite" (
    echo  [*] Initializing database...
    node backend/import-csv.js
    echo.
)

echo  [OK] Starting server at http://localhost:3000
echo  [OK] Open your browser to: http://localhost:3000
echo  [OK] Admin login:   admin@kbic.in / admin123
echo  [OK] Citizen login: citizen@kbic.in / pass123
echo.
echo  Press Ctrl+C to stop the server.
echo  ===================================================
echo.

:: Start server
node backend/server.js
