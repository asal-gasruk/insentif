# Verifikasi konfigurasi IIS + Node untuk Lahans Insentif
# Jalankan sebagai Administrator di VPS Windows.
#
# Mode reverse proxy (PM2 + ARR):
#   .\deploy\verify-iis.ps1 -IisPhysicalPath "...\deploy\iis"
#
# Mode HttpPlatform (IIS jalankan next langsung):
#   .\deploy\verify-iis.ps1 -WebRoot "C:\path\to\web" -Mode HttpPlatform

param(
    [string]$IisPhysicalPath = "",
    [string]$WebRoot = "",
    [ValidateSet("ReverseProxy", "HttpPlatform")]
    [string]$Mode = "ReverseProxy",
    [int]$NodePort = 3000,
    [string]$Pm2Name = "lahans-insentif"
)

$ErrorActionPreference = "Continue"
$ok = 0
$fail = 0
$failedItems = @()

function Test-Check {
    param([string]$Label, [bool]$Pass, [string]$Hint = "")
    if ($Pass) {
        Write-Host "[OK]   $Label" -ForegroundColor Green
        $script:ok++
    } else {
        Write-Host "[FAIL] $Label" -ForegroundColor Red
        if ($Hint) { Write-Host "       -> $Hint" -ForegroundColor Yellow }
        $script:fail++
        $script:failedItems += "${Label}: ${Hint}"
    }
}

Write-Host "`n=== Verifikasi Deploy Lahans Insentif ($Mode) ===`n" -ForegroundColor Cyan

if ($Mode -eq "HttpPlatform" -and -not $WebRoot) {
    $WebRoot = Split-Path -Parent $PSScriptRoot
}

# Node.js
Test-Check "Node.js terinstall" (Get-Command node -ErrorAction SilentlyContinue) "Install Node.js 20 LTS dari https://nodejs.org"
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "       Versi: $(node -v)"
}

# PM2 (hanya mode ReverseProxy)
$pm2Running = $false
if ($Mode -eq "ReverseProxy") {
    if (Get-Command pm2 -ErrorAction SilentlyContinue) {
        $pm2List = pm2 jlist 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
        $proc = $pm2List | Where-Object { $_.name -eq $Pm2Name -and $_.pm2_env.status -eq "online" }
        $pm2Running = [bool]$proc
        Test-Check "PM2 app '$Pm2Name' online" $pm2Running "cd folder web lalu: .\deploy\start-production.ps1"
    } else {
        Test-Check "PM2 terinstall" $false "npm install -g pm2 pm2-windows-startup"
    }
}

# Node HTTP (ReverseProxy = port 3000; HttpPlatform = cek build saja)
if ($Mode -eq "ReverseProxy") {
    $nodeOk = $false
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$NodePort" -UseBasicParsing -TimeoutSec 5
        $nodeOk = $resp.StatusCode -eq 200
    } catch {
        $nodeOk = $false
    }
    Test-Check "Next.js merespons http://127.0.0.1:$NodePort" $nodeOk "Jalankan: .\deploy\start-production.ps1"
} elseif ($WebRoot) {
    Test-Check "Folder .next (sudah npm run build)" (Test-Path (Join-Path $WebRoot ".next")) "cd `"$WebRoot`" lalu npm run build"
    Test-Check "node_modules/next ada" (Test-Path (Join-Path $WebRoot "node_modules\next")) "npm install"
}

# IIS modules
$rewriteOk = $false
$arrOk = $false
$proxyEnabled = $false
$httpPlatformOk = $false
try {
    Import-Module WebAdministration -ErrorAction Stop
    $modules = Get-WebGlobalModule | Select-Object -ExpandProperty Name
    $httpPlatformOk = $modules -match "httpPlatformHandler"

    if ($Mode -eq "ReverseProxy") {
        $rewriteOk = $modules -match "RewriteModule"
        $arrOk = $modules -match "ApplicationRequestRouting"
        Test-Check "Modul URL Rewrite terinstall" $rewriteOk "https://www.iis.net/downloads/microsoft/url-rewrite lalu iisreset"
        Test-Check "Modul ARR terinstall" $arrOk "https://www.iis.net/downloads/microsoft/application-request-routing lalu iisreset"

        if ($arrOk) {
            try {
                $proxyProp = Get-WebConfigurationProperty `
                    -PSPath "MACHINE/WEBROOT/APPHOST" `
                    -Filter "system.webServer/proxy" `
                    -Name "enabled" `
                    -ErrorAction Stop
                $proxyEnabled = [bool]$proxyProp.Value
            } catch {
                $proxyEnabled = $false
            }
            Test-Check "ARR proxy enabled" $proxyEnabled "IIS > server root > ARR > Enable proxy"
        }
    } else {
        Test-Check "Modul HttpPlatformHandler terinstall" $httpPlatformOk "https://www.iis.net/downloads/microsoft/httpplatformhandler lalu iisreset"
    }
} catch {
    Test-Check "PowerShell WebAdministration (Run as Admin)" $false "Buka PowerShell sebagai Administrator"
}

# web.config
if ($Mode -eq "HttpPlatform" -and $WebRoot) {
    $cfg = Join-Path $WebRoot "web.config"
    $cfgOk = Test-Path $cfg
    Test-Check "web.config ada di root web" $cfgOk "Jalankan: .\deploy\setup-iis-httpplatform.ps1"
    if ($cfgOk) {
        $content = Get-Content $cfg -Raw
        Test-Check "web.config memakai httpPlatform" ($content -match "httpPlatform") "Jalankan setup-iis-httpplatform.ps1 ulang"
    }
} elseif ($IisPhysicalPath) {
    $cfg = Join-Path $IisPhysicalPath "web.config"
    $cfgOk = Test-Path $cfg
    Test-Check "web.config ada di physical path IIS" $cfgOk "Jalankan: .\deploy\setup-iis.ps1 -IisPhysicalPath `"$IisPhysicalPath`""
    if ($cfgOk) {
        Write-Host "       Path: $cfg"
        $content = Get-Content $cfg -Raw
        Test-Check "web.config berisi rule reverse proxy" ($content -match "127\.0\.0\.1:$NodePort") "Jalankan setup-iis.ps1 ulang dengan -NodePort $NodePort"
    }
} else {
    Write-Host "[INFO] Lewati cek web.config — tambahkan parameter:" -ForegroundColor Gray
    Write-Host "       .\deploy\verify-iis.ps1 -IisPhysicalPath `"<physical path site IIS>`"" -ForegroundColor Gray
}

Write-Host "`n=== Ringkasan ===" -ForegroundColor Cyan
Write-Host "Lolos : $ok"
Write-Host "Gagal : $fail"

if ($fail -gt 0) {
    Write-Host "`n=== Perbaiki item berikut (urut prioritas) ===" -ForegroundColor Yellow
    $i = 1
    foreach ($item in $failedItems) {
        Write-Host "  $i. $item"
        $i++
    }
    Write-Host ""
    exit 1
}

Write-Host "`nSemua cek lolos. Restart site IIS lalu akses domain.`n" -ForegroundColor Green
exit 0
