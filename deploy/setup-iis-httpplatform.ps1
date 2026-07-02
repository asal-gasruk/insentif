# Setup IIS dengan HttpPlatformHandler (tanpa ARR / URL Rewrite)
# Jalankan sebagai Administrator dari folder web.
#
# Contoh:
#   cd C:\inetpub\wwwroot\lahans-insentif\lahans-insentif\web
#   .\deploy\setup-iis-httpplatform.ps1
#
# Lalu di IIS Manager:
#   Site > Basic Settings > Physical path = folder web ini (bukan deploy\iis)
#   Binding: hostname + port (mis. insentif.argoes.site :83)
#   Restart site

param(
    [string]$WebRoot = "",
    [string]$NodeExe = "C:\Program Files\nodejs\node.exe"
)

$ErrorActionPreference = "Stop"

if (-not $WebRoot) {
    $WebRoot = Split-Path -Parent $PSScriptRoot
}

$sourceConfig = Join-Path $PSScriptRoot "iis\web.config.httpplatform"
$destConfig = Join-Path $WebRoot "web.config"
$logsDir = Join-Path $WebRoot "logs"

if (-not (Test-Path $sourceConfig)) {
    Write-Error "File tidak ditemukan: $sourceConfig"
}

if (-not $WebRoot) {
    $WebRoot = Split-Path -Parent $PSScriptRoot
}

if (-not (Test-Path (Join-Path $WebRoot "package.json"))) {
    Write-Error "package.json tidak ditemukan di: $WebRoot"
}

if (-not (Test-Path $NodeExe)) {
    Write-Warning "Node.exe tidak di path default: $NodeExe — sesuaikan di web.config jika perlu"
}

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

$configContent = Get-Content $sourceConfig -Raw
if (Test-Path $NodeExe) {
    $configContent = $configContent -replace [regex]::Escape("C:\Program Files\nodejs\node.exe"), $NodeExe
}
Set-Content -Path $destConfig -Value $configContent -Encoding UTF8

Write-Host ""
Write-Host "OK — HttpPlatform web.config disalin ke:" -ForegroundColor Green
Write-Host "  $destConfig"
Write-Host "  Log folder: $logsDir"
Write-Host ""
Write-Host "Prasyarat modul IIS:" -ForegroundColor Yellow
Write-Host "  Install HttpPlatformHandler:"
Write-Host "  https://www.iis.net/downloads/microsoft/httpplatformhandler"
Write-Host "  Lalu: iisreset"
Write-Host ""
Write-Host "Build aplikasi (jika belum):" -ForegroundColor Yellow
Write-Host "  cd `"$WebRoot`""
Write-Host "  npm install"
Write-Host "  npm run build"
Write-Host ""
Write-Host "IIS Manager:" -ForegroundColor Cyan
Write-Host "  1. Site > Basic Settings > Physical path = $WebRoot"
Write-Host "  2. Application Pool > .NET CLR = No Managed Code"
Write-Host "  3. Restart site"
Write-Host ""
Write-Host "IIS_IUSRS butuh Read & Execute pada folder web." -ForegroundColor Gray
