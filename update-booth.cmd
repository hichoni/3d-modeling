@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File scripts\update-booth.ps1
pause
