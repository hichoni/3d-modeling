@echo off
cd /d "%~dp0"
if not exist bridge\setup.cjs (
  echo Download booth-setup.zip, extract it, and run the included configure-booth.cmd.
  start "" "https://hichoni.github.io/3d-modeling/downloads/booth-setup.zip"
  pause
  exit /b 1
)
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
