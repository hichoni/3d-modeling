@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS first: https://nodejs.org/
  pause
  exit /b 1
)
node bridge\setup.cjs --booth
if errorlevel 1 (
  pause
  exit /b 1
)
powershell.exe -NoProfile -File scripts\start-background.ps1
pause
