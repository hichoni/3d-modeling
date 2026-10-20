@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File scripts\install-autostart.ps1
pause
