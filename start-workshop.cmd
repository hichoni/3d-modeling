@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js LTS is required. https://nodejs.org/
  pause
  exit /b 1
)
if not exist runtime\config.json (
  node bridge\setup.cjs --web
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open the printer setup after the server starts: http://127.0.0.1:5188/studio.html#connect=1
node bridge\server.cjs
pause
