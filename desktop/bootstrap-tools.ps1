param([string]$Destination='')
$ErrorActionPreference='Stop'
$repoRoot=Split-Path -Parent $PSScriptRoot
if (-not $Destination) { $Destination=Join-Path $repoRoot 'artifacts\windows-build-tools' }
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
$Destination=(Resolve-Path -LiteralPath $Destination).Path
$versions=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'toolchain.json') -Raw | ConvertFrom-Json
$nodeZip=Join-Path $Destination ('node-'+$versions.node+'-win-x64.zip')
if (-not (Test-Path -LiteralPath $nodeZip)) { Invoke-WebRequest -Uri ('https://nodejs.org/dist/'+$versions.node+'/'+(Split-Path -Leaf $nodeZip)) -OutFile $nodeZip }
if ((Get-FileHash -LiteralPath $nodeZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $versions.nodeArchiveSha256) { throw 'Pinned Node archive checksum mismatch.' }
Expand-Archive -LiteralPath $nodeZip -DestinationPath (Join-Path $Destination 'node') -Force
$nodeBinary=Join-Path $Destination ('node\node-'+$versions.node+'-win-x64\node.exe')
$nodeSign=Get-AuthenticodeSignature -LiteralPath $nodeBinary
if ($nodeSign.Status -ne 'Valid' -or $nodeSign.SignerCertificate.Subject -notlike '*OpenJS Foundation*') { throw 'Official Node signature invalid.' }
$sdkZip=Join-Path $Destination 'windows-sdk.zip'
if (-not (Test-Path -LiteralPath $sdkZip)) { Invoke-WebRequest -Uri ('https://api.nuget.org/v3-flatcontainer/microsoft.windows.sdk.buildtools/'+$versions.windowsSdkBuildTools+'/microsoft.windows.sdk.buildtools.'+$versions.windowsSdkBuildTools+'.nupkg') -OutFile $sdkZip }
Expand-Archive -LiteralPath $sdkZip -DestinationPath (Join-Path $Destination 'windows-sdk') -Force
$makeAppx=Get-ChildItem -Path (Join-Path $Destination 'windows-sdk') -Recurse -Filter makeappx.exe | Where-Object { $_.FullName -match '\\x64\\' } | Select-Object -First 1
$signTool=Get-ChildItem -Path (Join-Path $Destination 'windows-sdk') -Recurse -Filter signtool.exe | Where-Object { $_.FullName -match '\\x64\\' } | Select-Object -First 1
foreach ($tool in @($makeAppx,$signTool)) { if (-not $tool) { throw 'Windows SDK tool missing.' }; $signature=Get-AuthenticodeSignature -LiteralPath $tool.FullName; if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notlike '*Microsoft Corporation*') { throw 'Microsoft SDK signature invalid.' } }
$result=[pscustomobject]@{node=$nodeBinary;makeappx=$makeAppx.FullName;signtool=$signTool.FullName}
$result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Destination 'tools.json')
if ($env:GITHUB_OUTPUT) { 'node='+$result.node | Out-File $env:GITHUB_OUTPUT -Append; 'makeappx='+$result.makeappx | Out-File $env:GITHUB_OUTPUT -Append; 'signtool='+$result.signtool | Out-File $env:GITHUB_OUTPUT -Append }
$result
