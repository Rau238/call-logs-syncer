# Sync secrets/ → project env files (run from repo root or secrets/)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root "package.json"))) {
    $root = $PSScriptRoot
    if (-not (Test-Path (Join-Path $root "..\package.json"))) {
        Write-Error "Run from repo root or secrets/ folder"
    }
    $root = Resolve-Path (Join-Path $root "..")
}

$secrets = Join-Path $root "secrets"

Copy-Item (Join-Path $secrets "api.env") (Join-Path $root "apps\api\.env") -Force
Write-Host "Synced apps/api/.env"

Copy-Item (Join-Path $secrets "ngrok.env") (Join-Path $root ".env.ngrok") -Force
Write-Host "Synced .env.ngrok"

$ngrokYml = Join-Path $root "infrastructure\ngrok\ngrok.yml"
Copy-Item (Join-Path $secrets "ngrok.yml") $ngrokYml -Force
Write-Host "Synced infrastructure/ngrok/ngrok.yml"

$mobileEnv = Get-Content (Join-Path $secrets "mobile.env.json") -Raw | ConvertFrom-Json
$envTs = @"
export const environment = {
  production: $($mobileEnv.production.ToString().ToLower()),
  apiUrl: '$($mobileEnv.apiUrl)',
  syncWindowDays: $($mobileEnv.syncWindowDays),
};
"@
$envTs | Set-Content (Join-Path $root "apps\mobile\src\environments\environment.ts") -Encoding utf8
$envTs | Set-Content (Join-Path $root "apps\mobile\src\environments\environment.prod.ts") -Encoding utf8
Write-Host "Synced mobile environments"

Write-Host "`nDone. Run: npm run dev"
