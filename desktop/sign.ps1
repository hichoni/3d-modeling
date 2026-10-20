param(
 [Parameter(Mandatory=$true)][string]$InputPath,
 [Parameter(Mandatory=$true)][string]$SignToolPath,
 [Parameter(Mandatory=$true)][string]$CertificateThumbprint,
 [Parameter(Mandatory=$true)][string]$ExpectedPublisher,
 [string]$TimestampUrl='http://timestamp.digicert.com'
)
$ErrorActionPreference='Stop'
if ($CertificateThumbprint -notmatch '^[a-fA-F0-9]{40}$') { throw 'Use a certificate thumbprint from the current user certificate store.' }
$cert=Get-Item -LiteralPath ('Cert:\CurrentUser\My\'+$CertificateThumbprint)
if (-not $cert.HasPrivateKey -or $cert.Subject -ne $ExpectedPublisher -or $cert.NotAfter -le (Get-Date)) { throw 'Certificate identity, private-key access or expiry is invalid.' }
if (-not ($cert.EnhancedKeyUsageList | Where-Object { $_.ObjectId -eq '1.3.6.1.5.5.7.3.3' })) { throw 'A code-signing certificate is required.' }
$toolSign=Get-AuthenticodeSignature -LiteralPath $SignToolPath
if ($toolSign.Status -ne 'Valid' -or $toolSign.SignerCertificate.Subject -notlike '*Microsoft Corporation*') { throw 'Microsoft SignTool signature invalid.' }
if ([System.IO.Path]::GetExtension($InputPath) -notin @('.exe','.msix')) { throw 'Only the built application EXE or MSIX is accepted.' }
& $SignToolPath sign /sha1 $CertificateThumbprint /s My /fd SHA256 /tr $TimestampUrl /td SHA256 /d 'Click Imagination Booth' $InputPath
if ($LASTEXITCODE -ne 0) { throw 'Signing failed.' }
& $SignToolPath verify /pa /all /v $InputPath
if ($LASTEXITCODE -ne 0) { throw 'Signature chain verification failed. Do not distribute this file.' }
$signed=Get-AuthenticodeSignature -LiteralPath $InputPath
if ($signed.Status -ne 'Valid' -or $signed.SignerCertificate.Subject -ne $ExpectedPublisher -or -not $signed.TimeStamperCertificate) { throw 'Trusted publisher and timestamp verification are required.' }
Write-Output 'Trusted publisher and timestamp verified. Target-school policy verification is still required.'
