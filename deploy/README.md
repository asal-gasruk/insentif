# Deploy Windows Server + IIS

Panduan deploy prototype ke **VPS Windows** dengan **IIS sebagai reverse proxy** dan **Node.js (PM2)** menjalankan Next.js.

## Arsitektur

```
Browser → IIS (port 80/83/443 + domain)
            ↓ web.config (URL Rewrite + ARR)
         Node.js next start (port 3000, PM2)
```

> Data aplikasi tersimpan di **localStorage browser** user — bukan di server.

## Prasyarat VPS

1. **Node.js 20 LTS** — https://nodejs.org
2. **IIS** terinstall
3. Modul IIS:
   - [URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)
   - [Application Request Routing (ARR) 3.0](https://www.iis.net/downloads/microsoft/application-request-routing)
4. **Enable proxy ARR** (sekali saja):
   - IIS Manager → klik **nama server** (root)
   - **Application Request Routing Cache** → **Server Proxy Settings**
   - Centang **Enable proxy** → Apply

## Struktur folder (disarankan)

```
C:\apps\lahans-insentif\web\     ← source code + npm + PM2
C:\inetpub\lahans-insentif-iis\  ← IIS site (hanya web.config)
```

Jangan arahkan IIS langsung ke folder source tanpa `web.config` — akan muncul **HTTP 403.14**.

## Langkah deploy

### 1. Copy source ke VPS

Extract/clone project ke misalnya `C:\apps\lahans-insentif\web`.

### 2. Build & jalankan Node (PM2)

PowerShell **Run as Administrator**:

```powershell
cd C:\apps\lahans-insentif\web
.\deploy\start-production.ps1
```

Tes: buka `http://localhost:3000` di browser VPS.

### 3. Setup IIS reverse proxy

```powershell
cd C:\apps\lahans-insentif\web
.\deploy\setup-iis.ps1 -IisPhysicalPath "C:\inetpub\lahans-insentif-iis"
```

Di **IIS Manager**:

1. **Add Website** (atau edit site existing)
2. **Physical path** = `C:\inetpub\lahans-insentif-iis`
3. **Binding** = hostname + port (mis. `insentif.argoes.site` port `83`)
4. **Restart** site

### 4. Firewall

```powershell
New-NetFirewallRule -DisplayName "IIS HTTP 83" -Direction Inbound -Protocol TCP -LocalPort 83 -Action Allow
```

Akses: `http://insentif.argoes.site:83`

# Mode B — HttpPlatformHandler (disarankan jika masih 404.4)

Lebih sederhana: **tanpa ARR, tanpa URL Rewrite, tanpa PM2**.

### Prasyarat

Install **HttpPlatformHandler**:  
https://www.iis.net/downloads/microsoft/httpplatformhandler

```powershell
iisreset
```

### Langkah

```powershell
cd C:\inetpub\wwwroot\lahans-insentif\lahans-insentif\web
npm install
npm run build
.\deploy\setup-iis-httpplatform.ps1
```

**IIS Manager:**

1. Site → **Basic Settings** → Physical path = **folder web** (yang ada `package.json`), **BUKAN** `deploy\iis`
2. Application Pool → **.NET CLR version** = **No Managed Code**
3. Binding: `insentif.argoes.site` port `83`
4. **Restart** site

Verifikasi:

```powershell
.\deploy\verify-iis.ps1 -Mode HttpPlatform -WebRoot "C:\inetpub\wwwroot\lahans-insentif\lahans-insentif\web"
```

Log error Node (jika gagal): `web\logs\iis-node*.log`

---

## Troubleshooting

| Error | Penyebab | Solusi |
|-------|----------|--------|
| **403.14 Forbidden** | IIS serve folder statis tanpa proxy | Pasang `web.config`, enable ARR proxy |
| **404.4 Not Found** (Handler: StaticFile) | **URL Rewrite belum terinstall** atau ARR proxy off — IIS abaikan `web.config` | Install URL Rewrite + ARR, enable proxy, restart IIS |
| **502 Bad Gateway** | Node tidak jalan | `pm2 status`, `pm2 restart lahans-insentif` |
| **`next` is not recognized** | Belum `npm install` | `npm install` lalu `npm run build` |
| Halaman polos | Cache dev / build korup | Hapus `.next`, `npm run build`, restart PM2 |

### Verifikasi otomatis (VPS)

```powershell
cd C:\path\to\web
.\deploy\verify-iis.ps1 -IisPhysicalPath "C:\inetpub\lahans-insentif-iis"
```

Ganti path sesuai **Physical Path** site di IIS Manager → Basic Settings.

### Physical Path site IIS

Boleh salah satu:

| Path | Keterangan |
|------|------------|
| `C:\inetpub\lahans-insentif-iis\` | **Disarankan** — folder kosong + `web.config` (via `setup-iis.ps1`) |
| `...\web\deploy\iis\` | OK asal file `web.config` ada di folder itu |

**Yang penting:** folder physical path harus berisi **`web.config`** reverse proxy, dan modul **URL Rewrite + ARR** harus terinstall.

## Update versi

```powershell
cd C:\apps\lahans-insentif\web
git pull   # jika pakai git
.\deploy\start-production.ps1
```

## File

| File | Fungsi |
|------|--------|
| `deploy/iis/web.config` | Reverse proxy IIS → Node port 3000 |
| `deploy/setup-iis.ps1` | Salin web.config ke folder site IIS |
| `deploy/start-production.ps1` | npm install, build, PM2 start |
