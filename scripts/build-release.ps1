<# .SYNOPSIS
  Build Aether Windows release with signed updater artifacts.
.DESCRIPTION
  Reads signing keys from project signing/ directory via AETHER_* env vars,
  generates tauri.updater.conf.json, and runs tauri build with updater support.
#>

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

function Expand-EnvValue([string]$value) {
  return [System.Environment]::ExpandEnvironmentVariables($value)
}

function Resolve-ProjectPath([string]$pathValue) {
  if ([string]::IsNullOrWhiteSpace($pathValue)) { return $null }
  $expanded = Expand-EnvValue $pathValue
  if ([System.IO.Path]::IsPathRooted($expanded)) { return $expanded }
  return Join-Path $projectRoot $expanded
}

# ── Load .env file ──
$envFile = Join-Path $projectRoot ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([^#=]+)=(.*)\s*$") {
      $key = $matches[1].Trim()
      $value = Expand-EnvValue $matches[2].Trim()
      Set-Item -Path "env:$key" -Value $value
    }
  }
  Write-Host "[+] Loaded .env file" -ForegroundColor Green
} else {
  Write-Host "[!] .env file not found. Create it with AETHER_* signing variables." -ForegroundColor Yellow
  Write-Host "    See signing/README.md" -ForegroundColor Yellow
  exit 1
}

function Get-EnvValue([string]$name, [string]$legacyName) {
  $value = (Get-ChildItem "env:$name" -ErrorAction SilentlyContinue)?.Value
  if ($value) { return $value }
  if ($legacyName) {
    return (Get-ChildItem "env:$legacyName" -ErrorAction SilentlyContinue)?.Value
  }
  return $null
}

$endpoint = Get-EnvValue "AETHER_UPDATER_ENDPOINT" "TAURI_UPDATER_ENDPOINT"
$publicKey = Get-EnvValue "AETHER_UPDATER_PUBLIC_KEY" "TAURI_UPDATER_PUBLIC_KEY"
$privateKeyPathValue = Get-EnvValue "AETHER_SIGNING_PRIVATE_KEY_PATH" "TAURI_SIGNING_PRIVATE_KEY_PATH"
if (-not $privateKeyPathValue) { $privateKeyPathValue = "signing/aether.key" }
$publicKeyPathValue = Get-EnvValue "AETHER_SIGNING_PUBLIC_KEY_PATH" "TAURI_SIGNING_PUBLIC_KEY_PATH"
if (-not $publicKeyPathValue) { $publicKeyPathValue = "signing/aether.key.pub" }
$privateKeyPassword = Get-EnvValue "AETHER_SIGNING_PRIVATE_KEY_PASSWORD" "TAURI_SIGNING_PRIVATE_KEY_PASSWORD"

$privateKeyPath = Resolve-ProjectPath $privateKeyPathValue
$publicKeyPath = Resolve-ProjectPath $publicKeyPathValue

if (-not $endpoint) {
  Write-Host "[!] Missing AETHER_UPDATER_ENDPOINT" -ForegroundColor Red
  exit 1
}

if (-not $publicKey -and (Test-Path $publicKeyPath)) {
  $publicKey = Get-Content $publicKeyPath -Raw
}

if (-not $publicKey) {
  Write-Host "[!] Missing AETHER_UPDATER_PUBLIC_KEY or signing/aether.key.pub" -ForegroundColor Red
  exit 1
}

# ── Generate updater config ──
$updaterConfig = @{
  bundle = @{
    createUpdaterArtifacts = $true
  }
  plugins = @{
    updater = @{
      endpoints = @($endpoint)
      pubkey = $publicKey.Trim()
      windows = @{
        installMode = "passive"
      }
    }
  }
}

$configPath = Join-Path $projectRoot "tauri.updater.conf.json"
$updaterConfig | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8
Write-Host "[+] Generated tauri.updater.conf.json" -ForegroundColor Green

# ── Read private key and set Tauri build env vars ──
if ($privateKeyPath -and (Test-Path $privateKeyPath)) {
  $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $privateKeyPath -Raw
  if ($privateKeyPassword) {
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $privateKeyPassword
  }
  Write-Host "[+] Loaded signing private key from $privateKeyPath" -ForegroundColor Green
} else {
  Write-Host "[!] AETHER_SIGNING_PRIVATE_KEY_PATH not set or file not found. Build will NOT produce signed artifacts." -ForegroundColor Yellow
  Write-Host "    Expected: signing/aether.key (run scripts\migrate-signing.ps1)" -ForegroundColor Yellow
}

# ── Build ──
Set-Location $projectRoot

Write-Host "[*] Starting tauri build..." -ForegroundColor Cyan
& "npx" tauri build --config tauri.updater.conf.json

if ($LASTEXITCODE -eq 0) {
  if (Test-Path $configPath) { Remove-Item $configPath }
  Write-Host "[+] Build completed successfully!" -ForegroundColor Green
  $bundleRoot = if ($env:CARGO_TARGET_DIR) { Join-Path $env:CARGO_TARGET_DIR "release\bundle\nsis" } else { Join-Path $projectRoot "src-tauri\target\release\bundle\nsis" }
  if (Test-Path $bundleRoot) {
    Write-Host "[+] Output: $(Get-ChildItem $bundleRoot -Filter '*.exe' | Select-Object -ExpandProperty Name)" -ForegroundColor Green
  }
} else {
  Write-Host "[!] Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
  if (Test-Path $configPath) { Remove-Item $configPath }
  exit $LASTEXITCODE
}
