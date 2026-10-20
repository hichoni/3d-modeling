param(
 [Parameter(Mandatory=$true)][string]$Stage,
 [Parameter(Mandatory=$true)][string]$MakeAppxPath,
 [ValidateSet('Preview','Store','Signed')][string]$Mode='Preview',
 [string]$IdentityName='Hichoni.ClickBooth.Preview', [string]$Publisher='CN=UNSIGNED-DEVELOPMENT',
 [string]$PublisherDisplayName='서명 준비 중', [string]$Version='3.0.0.0'
)
$ErrorActionPreference='Stop'
if ($IdentityName -notmatch '^[A-Za-z0-9.-]{3,50}$' -or $Version -notmatch '^\d+\.\d+\.\d+\.0$') { throw 'Invalid package name or version.' }
if ($Mode -ne 'Preview' -and ($Publisher -eq 'CN=UNSIGNED-DEVELOPMENT' -or $IdentityName -eq 'Hichoni.ClickBooth.Preview')) { throw 'Production publisher identity is missing.' }
if ($Mode -eq 'Signed') { $appSign=Get-AuthenticodeSignature -LiteralPath (Join-Path $Stage 'ClickBooth.exe'); if ($appSign.Status -ne 'Valid' -or $appSign.SignerCertificate.Subject -ne $Publisher) { throw 'App must have a valid trusted signature matching the package publisher before production packaging.' } }
$toolSign=Get-AuthenticodeSignature -LiteralPath $MakeAppxPath
if ($toolSign.Status -ne 'Valid' -or $toolSign.SignerCertificate.Subject -notlike '*Microsoft Corporation*') { throw 'Microsoft packaging tool signature invalid.' }
$assetDir=Join-Path $Stage 'Assets'; New-Item -ItemType Directory -Path $assetDir -Force | Out-Null
Add-Type -AssemblyName System.Drawing
foreach ($size in @(44,50,150)) {
 $bitmap=New-Object System.Drawing.Bitmap($size,$size); $graphics=[System.Drawing.Graphics]::FromImage($bitmap); $graphics.Clear([System.Drawing.Color]::FromArgb(255,249,237)); $graphics.SmoothingMode='AntiAlias'
 $brush=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,84,112)); $graphics.FillRectangle($brush,($size*.16),($size*.16),($size*.68),($size*.68))
 $font=New-Object System.Drawing.Font('Segoe UI',($size*.36),[System.Drawing.FontStyle]::Bold); $white=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
 $graphics.DrawString('C',$font,$white,($size*.23),($size*.19)); $bitmap.Save((Join-Path $assetDir ('Logo'+$size+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
 $white.Dispose(); $font.Dispose(); $brush.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$escapedPublisher=[System.Security.SecurityElement]::Escape($Publisher); $escapedDisplay=[System.Security.SecurityElement]::Escape($PublisherDisplayName)
$manifest=@"
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10" xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10" xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities" IgnorableNamespaces="uap rescap">
 <Identity Name="$IdentityName" Publisher="$escapedPublisher" Version="$Version" ProcessorArchitecture="x64" />
 <Properties><DisplayName>상상을 클릭하다! 운영자 공방</DisplayName><PublisherDisplayName>$escapedDisplay</PublisherDisplayName><Logo>Assets\Logo50.png</Logo><Description>3D 키캡 클리커 부스의 여러 A1 mini와 크롬북을 연결합니다.</Description></Properties>
 <Dependencies><TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" /></Dependencies>
 <Resources><Resource Language="ko-KR" /></Resources>
 <Applications><Application Id="ClickBooth" Executable="ClickBooth.exe" EntryPoint="Windows.FullTrustApplication"><uap:VisualElements DisplayName="상상을 클릭하다! 운영자 공방" Description="미니 등록과 부스 실행" BackgroundColor="#FFF9ED" Square150x150Logo="Assets\Logo150.png" Square44x44Logo="Assets\Logo44.png" /></Application></Applications>
 <Capabilities><Capability Name="internetClient" /><Capability Name="privateNetworkClientServer" /><rescap:Capability Name="runFullTrust" /></Capabilities>
</Package>
"@
$manifest | Set-Content -LiteralPath (Join-Path $Stage 'AppxManifest.xml') -Encoding UTF8
$suffix=if($Mode -eq 'Preview'){'UNSIGNED-PREVIEW'}elseif($Mode -eq 'Store'){'STORE-SUBMISSION-UNSIGNED'}else{'TO-BE-SIGNED'}
$package=Join-Path (Split-Path -Parent $Stage) ('ClickBooth-'+$Version+'-x64-'+$suffix+'.msix')
& $MakeAppxPath pack /d $Stage /p $package /o
if ($LASTEXITCODE -ne 0) { throw 'MakeAppx validation failed.' }
Get-FileHash -LiteralPath $package -Algorithm SHA256 | Select-Object Hash,@{Name='File';Expression={Split-Path -Leaf $_.Path}} | ConvertTo-Json | Set-Content -LiteralPath ($package+'.sha256.json')
Write-Output ('PACKAGE_OUTPUT='+$package)
