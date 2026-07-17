# Start ngrok tunnel - run AFTER: npm run dev

$ErrorActionPreference = "Stop"

$domain = "ninth-rebalance-deny.ngrok-free.dev"
$port = 3000
$minNgrokVersion = [version]"3.20.0"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envFile = Join-Path $root ".env.ngrok"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

function Get-NgrokExe {
    $cmd = Get-Command ngrok -ErrorAction SilentlyContinue
    if (-not $cmd) {
        return $null
    }
    return $cmd.Source
}

function Get-NgrokVersion {
    param([string]$Exe)
    $raw = & $Exe version 2>&1 | Out-String
    if ($raw -match '(\d+\.\d+\.\d+)') {
        return [version]$matches[1]
    }
    return [version]"0.0.0"
}

Write-Host ""
Write-Host "=== Call Log Sync - ngrok Tunnel ===" -ForegroundColor Cyan
Write-Host ""

try {
    Invoke-WebRequest -Uri "http://localhost:$port/health" -UseBasicParsing -TimeoutSec 3 | Out-Null
    Write-Host "[OK] API running on port $port" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] API not running on port $port" -ForegroundColor Red
    Write-Host "Start API first: npm run dev" -ForegroundColor Yellow
    exit 1
}

$token = $null
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*NGROK_AUTHTOKEN=(.+)$') {
            $token = $matches[1].Trim()
        }
    }
}

if (-not $token) {
    Write-Host "[ERROR] No authtoken in .env.ngrok" -ForegroundColor Red
    Write-Host "Copy .env.ngrok.example to .env.ngrok and add your token" -ForegroundColor Yellow
    exit 1
}

$ngrokExe = Get-NgrokExe
if (-not $ngrokExe) {
    Write-Host "[ERROR] ngrok not found in PATH" -ForegroundColor Red
    Write-Host "Install: winget install ngrok.ngrok" -ForegroundColor Yellow
    Write-Host "Or download: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

$ngrokVersion = Get-NgrokVersion -Exe $ngrokExe
Write-Host "[OK] ngrok $ngrokVersion at $ngrokExe" -ForegroundColor Green

if ($ngrokVersion -lt $minNgrokVersion) {
    Write-Host "[WARN] ngrok $ngrokVersion is too old (need $minNgrokVersion+). Updating..." -ForegroundColor Yellow
    & $ngrokExe update
    $ngrokVersion = Get-NgrokVersion -Exe $ngrokExe
    if ($ngrokVersion -lt $minNgrokVersion) {
        Write-Host "[ERROR] ngrok still too old after update: $ngrokVersion" -ForegroundColor Red
        Write-Host "Download latest from https://ngrok.com/download" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[OK] Updated to ngrok $ngrokVersion" -ForegroundColor Green
}

# Stop stale ngrok tunnels (e.g. old npx ngrok on port 5000)
$ngrokProcs = Get-Process ngrok -ErrorAction SilentlyContinue
if ($ngrokProcs) {
    Write-Host "[WARN] Stopping existing ngrok process(es)..." -ForegroundColor Yellow
    $ngrokProcs | Stop-Process -Force
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "Public URLs:" -ForegroundColor Cyan
Write-Host "  Dashboard:  https://$domain/"
Write-Host "  API:        https://$domain/api/v1"
Write-Host "  Health:     https://$domain/health"
Write-Host ""
Write-Host "Tunnel forwards to port $port (NOT 5000)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting ngrok..." -ForegroundColor Cyan
Write-Host ""

# Use system ngrok (NOT npx - npm package bundles outdated agent 3.19.0)
& $ngrokExe http $port --url="https://$domain" --authtoken=$token
