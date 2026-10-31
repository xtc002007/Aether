<# .SYNOPSIS
  Upload AETHER signing & release secrets to GitHub Actions.
.DESCRIPTION
  Requires: gh auth login
  Reads signing/aether.key* and .env password, verifies locally, then sets repository secrets.
  Supports: RELEASES_REPO_TOKEN, WINGET_PAT, AWS S3 and Azure Trusted Signing credentials.
#>
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

# 自动从 git remote 获取当前仓库，若无法获取则回退至默认仓库
$remoteUrl = git remote get-url origin 2>&1
if ($remoteUrl -match 'github\.com[:/]([^/]+/[^/.]+)') {
    $repo = $matches[1]
} else {
    $repo = "xtc002007/aether"
}

function Get-DotEnvValue([string]$name) {
  $envFile = Join-Path $root ".env"
  if (-not (Test-Path $envFile)) { return $null }
  foreach ($line in Get-Content $envFile) {
    if ($line -match "^\s*$name=(.*)\s*$") { return $matches[1].Trim() }
  }
  return $null
}

$privateKeyPath = Join-Path $root "signing\aether.key"
$publicKeyPath = Join-Path $root "signing\aether.key.pub"
if (-not (Test-Path $privateKeyPath)) { throw "Missing $privateKeyPath" }
if (-not (Test-Path $publicKeyPath)) { throw "Missing $publicKeyPath" }

$password = Get-DotEnvValue "AETHER_SIGNING_PRIVATE_KEY_PASSWORD"
if (-not $password) { throw "Missing AETHER_SIGNING_PRIVATE_KEY_PASSWORD in .env" }

gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  throw "gh is not logged in. Run: gh auth login"
}

$verifyScript = Join-Path $PSScriptRoot "verify-signing-key.ps1"
if (Test-Path $verifyScript) {
  Write-Host "[*] Verifying local signing key and password..." -ForegroundColor Cyan
  & $verifyScript
}

$privateKey = (Get-Content $privateKeyPath -Raw).TrimEnd()
$publicKey = (Get-Content $publicKeyPath -Raw).TrimEnd()

Write-Host "[*] Uploading core signing secrets to $repo ..." -ForegroundColor Cyan
$privateKey | gh secret set AETHER_SIGNING_PRIVATE_KEY -R $repo
gh secret set AETHER_SIGNING_PRIVATE_KEY_PASSWORD -R $repo -b $password
$publicKey | gh secret set AETHER_UPDATER_PUBLIC_KEY -R $repo
Write-Host "[+] Minisign signing keys uploaded successfully." -ForegroundColor Green

# 1. NEXUSTOOLS_CONFIG_KEY
$apiKey = Get-DotEnvValue "NEXUSTOOLS_CONFIG_KEY"
if (-not $apiKey) {
  $awsEnv = Join-Path (Resolve-Path (Join-Path $root "..\..\NexusTools\services-aws")) ".env"
  if (Test-Path $awsEnv) {
    foreach ($line in Get-Content $awsEnv) {
      if ($line -match '^\s*LOCAL_CONFIG_KEY=(.*)\s*$') { $apiKey = $matches[1].Trim(); break }
    }
  }
}
if ($apiKey) {
  gh secret set NEXUSTOOLS_CONFIG_KEY -R $repo -b $apiKey
  Write-Host "[+] NEXUSTOOLS_CONFIG_KEY set" -ForegroundColor Green
} else {
  Write-Host "[!] NEXUSTOOLS_CONFIG_KEY skipped (optional)" -ForegroundColor Yellow
}

# 2. PAT_TOKEN for NexusTools-shared
$patToken = $env:PAT_TOKEN
if (-not $patToken) { $patToken = Get-DotEnvValue "PAT_TOKEN" }
if ($patToken) {
  gh secret set PAT_TOKEN -R $repo -b $patToken
  Write-Host "[+] PAT_TOKEN set" -ForegroundColor Green
} else {
  Write-Host "[!] PAT_TOKEN skipped (set if CI needs NexusTools-shared)" -ForegroundColor Yellow
}

# 3. AWS S3 Upload Credentials
$awsKey = $env:AWS_ACCESS_KEY_ID
$awsSecret = $env:AWS_SECRET_ACCESS_KEY
if (-not $awsKey) { $awsKey = Get-DotEnvValue "AWS_ACCESS_KEY_ID" }
if (-not $awsSecret) { $awsSecret = Get-DotEnvValue "AWS_SECRET_ACCESS_KEY" }
if ($awsKey -and $awsSecret) {
  gh secret set AWS_ACCESS_KEY_ID -R $repo -b $awsKey
  gh secret set AWS_SECRET_ACCESS_KEY -R $repo -b $awsSecret
  Write-Host "[+] AWS S3 upload secrets set" -ForegroundColor Green
} else {
  Write-Host "[!] AWS credentials skipped (needed for S3 release uploads)" -ForegroundColor Yellow
}

# 4. RELEASES_REPO_TOKEN (for publishing from private repo to public repo)
$releaseToken = $env:RELEASES_REPO_TOKEN
if (-not $releaseToken) { $releaseToken = Get-DotEnvValue "RELEASES_REPO_TOKEN" }
if ($releaseToken) {
  gh secret set RELEASES_REPO_TOKEN -R $repo -b $releaseToken
  Write-Host "[+] RELEASES_REPO_TOKEN set" -ForegroundColor Green
} else {
  Write-Host "[!] RELEASES_REPO_TOKEN skipped (needed for private repo to publish to public releases)" -ForegroundColor Yellow
}

# 5. WINGET_PAT (for automated winget PR submissions)
$wingetPat = $env:WINGET_PAT
if (-not $wingetPat) { $wingetPat = Get-DotEnvValue "WINGET_PAT" }
if ($wingetPat) {
  gh secret set WINGET_PAT -R $repo -b $wingetPat
  Write-Host "[+] WINGET_PAT set" -ForegroundColor Green
} else {
  Write-Host "[!] WINGET_PAT skipped (needed for automated winget PRs)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[OK] Secrets configuration completed for $repo." -ForegroundColor Green
