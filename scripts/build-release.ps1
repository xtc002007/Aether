<# .SYNOPSIS
  Build Aether Windows release with signed updater artifacts.
.DESCRIPTION
  Reads signing keys from .env file, generates tauri.updater.conf.json,
  and runs tauri build with updater support.
.NOTES
  Requires: tauri.conf.json with updater endpoint configured in .env
  Output: NSIS installer + MSI + portable ZIP in src-tauri/target/release/bundle/
#>

$ErrorActionPreference = "Stop"

# ── Load .env file ──
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([^#=]+)=(.*)\s*$") {
      $key = $matches[1].Trim()
      $value = $matches[2].Trim()
      $value = [System.Environment]::ExpandEnvironmentVariables($value)
      Set-Item -Path "env:$key" -Value $value
    }
  }
  Write-Host "[+] Loaded .env file" -ForegroundColor Green
} else {
  Write-Host "[!] .env file not found. Create it with:" -ForegroundColor Yellow
  Write-Host "    TAURI_SIGNING_PRIVATE_KEY_PATH=..." -ForegroundColor Yellow
  Write-Host "    TAURI_SIGNING_PRIVATE_KEY_PASSWORD=..." -ForegroundColor Yellow
  Write-Host "    TAURI_UPDATER_PUBLIC_KEY=..." -ForegroundColor Yellow
  exit 1
}

# ── Validate required env vars ──
$required = @("TAURI_UPDATER_PUBLIC_KEY", "TAURI_UPDATER_ENDPOINT")
$missing = $required | Where-Object { -not (Get-ChildItem "env:$_" -ErrorAction SilentlyContinue) }
if ($missing) {
  Write-Host "[!] Missing required env vars: $($missing -join ', ')" -ForegroundColor Red
  exit 1
}

$publicKey = $env:TAURI_UPDATER_PUBLIC_KEY
$endpoint = $env:TAURI_UPDATER_ENDPOINT

# ── Generate updater config ──
$updaterConfig = @{
  bundle = @{
    createUpdaterArtifacts = $true
  }
  plugins = @{
    updater = @{
      endpoints = @($endpoint)
      pubkey = $publicKey
      windows = @{
        installMode = "passive"
      }
    }
  }
}

$configPath = Join-Path $PSScriptRoot "..\tauri.updater.conf.json"
$updaterConfig | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8
Write-Host "[+] Generated tauri.updater.conf.json" -ForegroundColor Green

# ── Read private key and set env var ──
$keyPath = $env:TAURI_SIGNING_PRIVATE_KEY_PATH
if ($keyPath -and (Test-Path $keyPath)) {
  $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $keyPath -Raw
  Write-Host "[+] Loaded signing private key from $keyPath" -ForegroundColor Green
} else {
  Write-Host "[!] TAURI_SIGNING_PRIVATE_KEY_PATH not set or file not found. Build will NOT produce signed artifacts." -ForegroundColor Yellow
  Write-Host "    Set TAURI_SIGNING_PRIVATE_KEY_PATH to your aether.key path" -ForegroundColor Yellow
}

# ── Build ──
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

Write-Host "[*] Starting tauri build..." -ForegroundColor Cyan
& "npx" tauri build --config tauri.updater.conf.json

if ($LASTEXITCODE -eq 0) {
  # Clean up generated config
  if (Test-Path $configPath) { Remove-Item $configPath }
  Write-Host "[+] Build completed successfully!" -ForegroundColor Green
  $bundleRoot = if ($env:CARGO_TARGET_DIR) { Join-Path $env:CARGO_TARGET_DIR "release\bundle\nsis" } else { Join-Path $PSScriptRoot "..\src-tauri\target\release\bundle\nsis" }
  if (Test-Path $bundleRoot) {
    Write-Host "[+] Output: $(Get-ChildItem $bundleRoot -Filter '*.exe' | Select-Object -ExpandProperty Name)" -ForegroundColor Green
  }
} else {
  Write-Host "[!] Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
  if (Test-Path $configPath) { Remove-Item $configPath }
  exit $LASTEXITCODE
}
