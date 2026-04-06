@echo off
title ArbiterX — Starting All Systems

echo.
echo  ==========================================
echo   ArbiterX Arbitrage Bot — Full Startup
echo  ==========================================
echo.

:: Kill any existing node processes
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo  [1/3] Starting Backend (port 4000)...
start "ArbiterX Backend" cmd /k "cd /d %~dp0backend && node index.js"
timeout /t 3 /nobreak >nul

echo  [2/3] Starting Scraper Manager...
start "ArbiterX Scrapers" cmd /k "cd /d %~dp0backend && node scrapers/manager.js"
timeout /t 2 /nobreak >nul

echo  [3/3] Starting Frontend (port 9002)...
start "ArbiterX Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo  ==========================================
echo   All systems started!
echo   Dashboard: http://localhost:9002/dashboard
echo   API:       http://localhost:4000/api/health
echo  ==========================================
echo.
echo  3 windows opened. Close them to stop.
pause
