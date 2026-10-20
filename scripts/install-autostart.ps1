$ErrorActionPreference = 'Stop'
$workshopRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $workshopRoot 'runtime\config.json'))) { throw 'Run configure-booth.cmd first.' }
$startupPath = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupPath 'Click Imagination Booth.lnk'
if (Test-Path -LiteralPath $shortcutPath) { throw 'Autostart already exists. Remove it before reinstalling.' }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
$backgroundScript = Join-Path $PSScriptRoot 'start-background.ps1'
$shortcut.Arguments = '-NoProfile -WindowStyle Hidden -File "' + $backgroundScript + '" -NoBrowser'
$shortcut.WorkingDirectory = $workshopRoot
$shortcut.WindowStyle = 7
$shortcut.Description = 'Start the 3D keycap booth server after this Windows user signs in.'
$shortcut.Save()
Write-Host 'Installed: this user sign-in starts the booth PC server in the background.'
Write-Host ('To undo, remove this shortcut: ' + $shortcutPath)
Write-Host 'Keep the PC awake and connected to the booth Wi-Fi during the event.'
