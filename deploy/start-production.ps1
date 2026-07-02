# Build & jalankan Next.js production via PM2 (Windows)
# Jalankan dari folder web (root project Next.js).
#
# Contoh:
#   cd C:\apps\lahans-insentif\web
#   .\deploy\start-production.ps1

param(
    [int]$Port = 3000,
    [string]$Pm2Name = "lahans-insentif"
)

$ErrorActionPreference = "Stop"

$webRoot = Split-Path -Parent $PSScriptRoot
Set-Location $webRoot

Write-Host "Working directory: $webRoot" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js belum terinstall. Unduh Node.js 20 LTS dari https://nodejs.org"
}

Write-Host "`n[1/4] npm install..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[2/4] npm run build..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[3/4] PM2 setup..." -ForegroundColor Yellow
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "Menginstall PM2 global..."
    npm install -g pm2
    npm install -g pm2-windows-startup
    pm2-startup install
}

$env:PORT = $Port
pm2 delete $Pm2Name 2>$null
pm2 start npm --name $Pm2Name -- start
pm2 save

Write-Host "`n[4/4] Verifikasi..." -ForegroundColor Yellow
pm2 status

Write-Host ""
Write-Host "Production server berjalan di http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "Lanjut setup IIS reverse proxy:"
Write-Host "  .\deploy\setup-iis.ps1 -IisPhysicalPath `"C:\inetpub\lahans-insentif-iis`" -NodePort $Port"
