@echo off
setlocal
cd /d "%~dp0"
title EARTHPULSE demo server
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install it from https://nodejs.org then run this file again.
  pause
  exit /b 1
)
set NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main
set PORT=4310
echo.
echo [1/2] Building the site ...
call node scripts\build.mjs
if errorlevel 1 (
  echo Build failed - see the message above.
  pause
  exit /b 1
)
echo.
echo [2/2] Starting EARTHPULSE on http://127.0.0.1:%PORT%/  (close this window to stop)
echo      Demo page: http://127.0.0.1:%PORT%/pages/studio.html?demo=1
start "" "http://127.0.0.1:%PORT%/pages/studio.html?demo=1"
node scripts\serve.mjs %PORT%
pause
