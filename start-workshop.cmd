@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js LTS is required. https://nodejs.org/
  pause
  exit /b 1
)
if not exist runtime\config.json node bridge\setup.cjs
node bridge\server.cjs
pause
