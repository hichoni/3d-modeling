param(
 [Parameter(Mandatory=$true)][string]$NodePath,
 [string]$DotnetPath='dotnet', [string]$MakeAppxPath='',
 [ValidateSet('Preview','Store')][string]$Mode='Preview',
 [string]$IdentityName='Hichoni.ClickBooth.Preview', [string]$Publisher='CN=UNSIGNED-DEVELOPMENT',
 [string]$PublisherDisplayName='서명 준비 중', [string]$Version='3.0.0.0',
 [string]$OutputRoot=''
)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path -Parent $PSScriptRoot
$nodeSignature=Get-AuthenticodeSignature -LiteralPath $NodePath
if ($nodeSignature.Status -ne 'Valid' -or $nodeSignature.SignerCertificate.Subject -notlike '*OpenJS Foundation*') { throw 'The official OpenJS-signed Node runtime is required.' }
if ($Version -notmatch '^\d+\.\d+\.\d+\.0$') { throw 'MSIX version must have four components and end with .0.' }
if ($IdentityName -notmatch '^[A-Za-z0-9.-]{3,50}$') { throw 'Invalid package identity name.' }
if ($Mode -ne 'Preview' -and ($Publisher -eq 'CN=UNSIGNED-DEVELOPMENT' -or $IdentityName -eq 'Hichoni.ClickBooth.Preview')) { throw 'Real signing or Partner Center identity is required. Preview identity cannot become a production release.' }
if (-not $OutputRoot) { $OutputRoot=Join-Path $repoRoot ('artifacts\desktop-build\'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff')) }
if (Test-Path -LiteralPath $OutputRoot) { throw 'Output directory already exists. Use a fresh directory; never overwrite an installed app.' }
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$OutputRoot=(Resolve-Path -LiteralPath $OutputRoot).Path
$stage=Join-Path $OutputRoot 'app'; New-Item -ItemType Directory -Path $stage | Out-Null
& $NodePath (Join-Path $repoRoot 'desktop\prepare-payload.cjs') $NodePath $stage
if ($LASTEXITCODE -ne 0) { throw 'Payload preparation failed' }
$env:DOTNET_CLI_HOME=Join-Path $repoRoot 'artifacts\dotnet-home'
$env:DOTNET_CLI_TELEMETRY_OPTOUT='1'
$env:DOTNET_GENERATE_ASPNET_CERTIFICATE='false'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1'
$env:NUGET_PACKAGES=Join-Path $repoRoot 'artifacts\nuget-packages'
& $DotnetPath publish (Join-Path $PSScriptRoot 'ClickBooth\ClickBooth.csproj') -c Release -r win-x64 --self-contained true -o $stage --nologo
if ($LASTEXITCODE -ne 0) { throw 'Desktop publish failed' }
if ($MakeAppxPath) {
 & (Join-Path $PSScriptRoot 'package.ps1') -Stage $stage -MakeAppxPath $MakeAppxPath -IdentityName $IdentityName -Publisher $Publisher -PublisherDisplayName $PublisherDisplayName -Version $Version -Mode $Mode
 if ($LASTEXITCODE -ne 0) { throw 'MSIX packaging failed' }
}
[pscustomobject]@{stage=$stage;mode=$Mode;version=$Version;identity=$IdentityName;publisher=$Publisher;signed=$false;storeCertified=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputRoot 'build-info.json')
Write-Output ('BUILD_OUTPUT='+$OutputRoot)
