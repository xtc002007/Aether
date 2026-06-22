<# .SYNOPSIS
  Migrate Aether updater signing keys into the project signing/ directory.
#>

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$signingDir = Join-Path $projectRoot "signing"
$privateKeyName = "aether.key"
$publicKeyName = "aether.key.pub"
$legacyDir = Join-Path $env:USERPROFILE ".tauri"
$legacyPrivate = Join-Path $legacyDir $privateKeyName
$legacyPublic = Join-Path $legacyDir $publicKeyName
$targetPrivate = Join-Path $signingDir $privateKeyName
$targetPublic = Join-Path $signingDir $publicKeyName

New-Item -ItemType Directory -Force -Path $signingDir | Out-Null

function Copy-IfMissing($source, $target, $label) {
  if (-not (Test-Path $source)) {
    Write-Host "[!] Legacy $label not found: $source" -ForegroundColor Yellow
    return $false
  }
  if (Test-Path $target) {
    Write-Host "[=] $label already exists, skipped: $target" -ForegroundColor DarkYellow
    return $true
  }
  Copy-Item $source $target
  Write-Host "[+] Copied $label -> $target" -ForegroundColor Green
  return $true
}

$privateCopied = Copy-IfMissing $legacyPrivate $targetPrivate "private key"
$publicCopied = Copy-IfMissing $legacyPublic $targetPublic "public key"

if (-not $privateCopied -and -not (Test-Path $targetPrivate)) {
  Write-Host ""
  Write-Host "No private key found. Generate one with:" -ForegroundColor Cyan
  Write-Host "  npx tauri signer generate -w `"$targetPrivate`"" -ForegroundColor White
}

Write-Host ""
Write-Host "Next: update .env to use project-local paths:" -ForegroundColor Cyan
Write-Host "  AETHER_SIGNING_PRIVATE_KEY_PATH=signing/aether.key" -ForegroundColor White
Write-Host "  AETHER_SIGNING_PUBLIC_KEY_PATH=signing/aether.key.pub" -ForegroundColor White
Write-Host "  AETHER_SIGNING_PRIVATE_KEY_PASSWORD=<your-password>" -ForegroundColor White
Write-Host "  AETHER_UPDATER_ENDPOINT=https://github.com/xtc002007/Aether/releases/latest/download/latest.json" -ForegroundColor White
