# Setup IIS reverse proxy untuk Lahans Insentif (Next.js)
# Jalankan di PowerShell sebagai Administrator.
#
# Contoh:
#   .\deploy\setup-iis.ps1 -IisPhysicalPath "C:\inetpub\lahans-insentif-iis"
#
# Sebelum menjalankan script ini:
# 1. Install URL Rewrite + ARR 3.0 di IIS
# 2. IIS Manager > server root > ARR > Server Proxy Settings > Enable proxy
# 3. Buat site IIS dengan Physical Path = folder yang sama dengan -IisPhysicalPath

param(
    [Parameter(Mandatory = $true)]
    [string]$IisPhysicalPath,

    [int]$NodePort = 3000
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceConfig = Join-Path $scriptDir "iis\web.config"

if (-not (Test-Path $sourceConfig)) {
    Write-Error "File tidak ditemukan: $sourceConfig"
}

if (-not (Test-Path $IisPhysicalPath)) {
    Write-Host "Membuat folder: $IisPhysicalPath"
    New-Item -ItemType Directory -Path $IisPhysicalPath -Force | Out-Null
}

# Salin web.config; sesuaikan port Node jika bukan 3000
$configContent = Get-Content $sourceConfig -Raw
$configContent = $configContent -replace "127\.0\.0\.1:3000", "127.0.0.1:$NodePort"
$destConfig = Join-Path $IisPhysicalPath "web.config"
Set-Content -Path $destConfig -Value $configContent -Encoding UTF8

Write-Host ""
Write-Host "OK — web.config disalin ke:" -ForegroundColor Green
Write-Host "  $destConfig"
Write-Host ""
Write-Host "Langkah berikutnya di IIS Manager:"
Write-Host "  1. Site > Basic Settings > Physical path = $IisPhysicalPath"
Write-Host "  2. Binding: hostname + port (mis. insentif.argoes.site :83)"
Write-Host "  3. Restart site"
Write-Host ""
Write-Host "Pastikan Node.js sudah jalan:"
Write-Host "  cd <folder-web>"
Write-Host "  .\deploy\start-production.ps1"
Write-Host ""
Write-Host "Tes lokal Node : http://127.0.0.1:$NodePort"
Write-Host "Tes via IIS     : http://<hostname>:<port>"
