param([Parameter(Mandatory=$true)][string]$Stage,[Parameter(Mandatory=$true)][string]$Package,[Parameter(Mandatory=$true)][string]$ExpectedPublisher)
$ErrorActionPreference='Stop'
foreach ($file in @((Join-Path $Stage 'ClickBooth.exe'),$Package)) {
 $signature=Get-AuthenticodeSignature -LiteralPath $file
 if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -ne $ExpectedPublisher -or -not $signature.TimeStamperCertificate) { throw ('Production publisher/timestamp validation failed: '+(Split-Path -Leaf $file)) }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[System.IO.Compression.ZipFile]::OpenRead($Package)
try { if (-not $archive.GetEntry('AppxSignature.p7x')) { throw 'MSIX signature missing.' }; if ($archive.Entries | Where-Object { $_.FullName -match '(^|/)(runtime|artifacts|jobs|\.git)/|\.(cmd|ps1|pfx|p12|key)$' }) { throw 'Private data or script launcher in the production package.' } } finally { $archive.Dispose() }
$report=[pscustomobject]@{file=(Split-Path -Leaf $Package);sha256=(Get-FileHash -LiteralPath $Package -Algorithm SHA256).Hash.ToLowerInvariant();publisher=$ExpectedPublisher;authenticode='Valid';timestamp=$true;schoolPolicyTest='pending'}
$report | ConvertTo-Json | Set-Content -LiteralPath ($Package+'.release.json')
Write-Output 'Signed release verified. This does not certify acceptance by a separate school policy.'
