@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File scripts\start-background.ps1
if errorlevel 1 pause
