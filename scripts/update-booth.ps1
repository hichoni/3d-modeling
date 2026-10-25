# One-click update of this click-workshop folder to the latest public booth ZIP (update-booth.cmd).
# runtime\ (printers, access codes, PINs, jobs, statistics) is never in the ZIP, so nothing in it is overwritten;
# its settings are still backed up first. A busy workshop is never stopped.
param([string]$Source = 'https://hichoni.github.io/3d-modeling/downloads/booth-setup.zip')
$ErrorActionPreference = 'Stop'
$workshopRoot = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $workshopRoot 'runtime'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$probe = $null
try { $probe = Invoke-RestMethod -Uri 'http://127.0.0.1:5188/api/bootstrap' -TimeoutSec 2 } catch {}
$running = $probe -and $probe.app -eq 'click-workshop'
if ($running) {
  # API v9 reports uploads and slicing too; older servers only report printers.
  $busy = if ($null -ne $probe.busy) { [bool]$probe.busy } else { @($probe.printers | Where-Object { $_.busy }).Count -gt 0 }
  if ($busy) { throw 'A print, upload or slice is in progress. Run update-booth.cmd again after it finishes.' }
  if ($null -eq $probe.busy) {
    $answer = Read-Host 'This older workshop cannot report uploads. Are all printers idle and is no student sending a print? (Y/N)'
    if ($answer -notmatch '^[Yy]') { throw 'Update cancelled. Nothing was changed.' }
  }
}

$temp = Join-Path ([IO.Path]::GetTempPath()) ('click-workshop-update-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  $zip = Join-Path $temp 'booth-setup.zip'
  Write-Host 'Downloading the latest booth files...'
  if (Test-Path -LiteralPath $Source) { Copy-Item -LiteralPath $Source -Destination $zip } else { Invoke-WebRequest -Uri $Source -OutFile $zip -UseBasicParsing }
  Expand-Archive -LiteralPath $zip -DestinationPath $temp
  $fresh = Join-Path $temp 'click-workshop'
  if (-not (Test-Path -LiteralPath (Join-Path $fresh 'bridge\server.cjs'))) { throw 'The download is not a booth ZIP. Nothing was changed.' }
  if (Test-Path -LiteralPath (Join-Path $fresh 'runtime')) { throw 'The download contains a runtime folder. Nothing was changed.' }

  if (Test-Path -LiteralPath $runtimePath) {
    # Settings, pairings and statistics; job files stay where they are and are not touched by the update.
    $backup = Join-Path $workshopRoot ('runtime-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $backup | Out-Null
    Get-ChildItem -LiteralPath $runtimePath -Force | Where-Object { $_.Name -ne 'jobs' } | Copy-Item -Destination $backup -Recurse
    Write-Host ('Settings backed up to ' + $backup)
  }

  if ($running) {
    $stopped = $false
    $pidFile = Join-Path $runtimePath 'server.pid'
    if (Test-Path -LiteralPath $pidFile) {
      $process = Get-Process -Id ([int](Get-Content -LiteralPath $pidFile -Raw).Trim()) -ErrorAction SilentlyContinue
      if ($process -and $process.ProcessName -eq 'node') { Stop-Process -Id $process.Id; $process.WaitForExit(10000) | Out-Null; $stopped = $true }
    }
    if (-not $stopped) { throw 'Close the workshop server window (start-workshop.cmd) or the ClickBooth app, then run update-booth.cmd again. Nothing was changed.' }
  }

  Copy-Item -Path (Join-Path $fresh '*') -Destination $workshopRoot -Recurse -Force
  Write-Host 'The booth PC program is up to date.'
} finally {
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}

if ($running) { & (Join-Path $PSScriptRoot 'start-background.ps1') }
else { Write-Host 'Start the workshop again with start-booth.cmd or start-workshop.cmd.' }
