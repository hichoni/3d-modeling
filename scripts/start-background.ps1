param([switch]$NoBrowser,[switch]$Studio)
$ErrorActionPreference = 'Stop'
$workshopRoot = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
$runtimePath = Join-Path $workshopRoot 'runtime'
if (-not (Test-Path -LiteralPath (Join-Path $runtimePath 'config.json'))) { throw 'Run configure-booth.cmd first.' }
$config = Get-Content -LiteralPath (Join-Path $runtimePath 'config.json') -Raw | ConvertFrom-Json
$expectedBoothOrigin = if ($config.booth.enabled -eq $true) { 'http://' + $config.booth.host + ':5188' } else { $null }
$running = $false
$probe = $null
try {
  $probe = Invoke-RestMethod -Uri 'http://127.0.0.1:5188/api/bootstrap' -TimeoutSec 2
  $running = $probe.app -eq 'click-workshop'
} catch {}
$expectedPrinterCount = if ($config.printers.Count -gt 0) { $config.printers.Count } else { 1 }
if ($running -and ($probe.version -lt 10 -or -not $probe.setupGuide -or [bool]$probe.booth -ne [bool]$config.booth.enabled -or $probe.boothOrigin -ne $expectedBoothOrigin -or $probe.printers.Count -ne $expectedPrinterCount)) {
  throw 'An older workshop or different booth configuration is still running. Close its server first, then run start-booth.cmd. Check the printer before restarting.'
}
if (-not $running) {
  $serverPath = Join-Path $workshopRoot 'bridge\server.cjs'
  $child = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $workshopRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'server.log') -RedirectStandardError (Join-Path $runtimePath 'server-error.log') -PassThru
  Set-Content -LiteralPath (Join-Path $runtimePath 'server.pid') -Value $child.Id
  for ($attempt = 0; $attempt -lt 15; $attempt++) {
    try { $probe = Invoke-RestMethod -Uri 'http://127.0.0.1:5188/api/bootstrap' -TimeoutSec 1; if ($probe.app -eq 'click-workshop') { $running = $true; break } } catch {}
    Start-Sleep -Milliseconds 300
  }
  if (-not $running) { throw 'Workshop did not start. Check runtime/server-error.log. An older server may already use port 5188.' }
}
if (-not $NoBrowser) { $launchUrl = if ($Studio) { 'http://127.0.0.1:5188/studio.html#connect=1' } else { 'http://127.0.0.1:5188/' }; Start-Process $launchUrl }
