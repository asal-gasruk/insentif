# Lahans Insentif Reguler 2026 — Prototype

Prototype web app berdasarkan dokumen **Skema Insentif Reguler - Plan 2026.xlsx**.
Konfigurasi insentif sepenuhnya dinamis berbasis **Parameter Insentif** — semua 14 sheet/lampiran dokumen telah diimplementasikan.

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- localStorage (CRUD tanpa backend)

## Fitur

| Menu | Fungsi |
|------|--------|
| Dashboard | Ringkasan skema, data, dan total insentif |
| Skema Insentif | Konfigurasi per role: template rumus atau **rule builder** custom per parameter, penalty multi-aturan |
| Master Parameter | CRUD parameter insentif (All Product, EC, NOO, AO, Contract, dll) |
| Master Tier | CRUD tier pencapaian (rentang %, bisa ditambah) |
| Master Cabang | CRUD cabang (MB, SB, NB, dll) |
| Karyawan | CRUD karyawan (role, posisi, tim, armada untuk Delivery) |
| Bobot Parameter | Bobot per skema × segment, kolom dinamis sesuai parameter |
| Nominal Insentif | Nominal per tier; breakdown otomatis = bobot × total |
| Pencapaian | Input % pencapaian, field dinamis sesuai bobot skema |
| Pengiriman (DT) | Data kartonase & drop point untuk Delivery Team |
| Perhitungan | Kalkulasi gabungan skema parameter + volume tier |

## Skema yang Di-seed (dari dokumen)

| Skema | Tipe | Segment | Periode |
|-------|------|---------|---------|
| Canvass Team (GT) | Parameter | MB / SB / NB | Bulanan |
| Taking Order (GT) | Parameter | MB / SB / NB | Bulanan |
| SLD Mix | Parameter | MB / SB / NB | Bulanan |
| ASS | Parameter | MB / SB / NB | Bulanan |
| ASM | Parameter | Jawa / Luar Pulau | Bulanan |
| RSM | Parameter | Direct / Indirect | Bulanan/Kuartal |
| NSM | Parameter | Direct / Indirect / National | Kuartalan |
| Sales Team (MT) | Parameter | — | Bulanan |
| Sales SPV (MT) | Parameter | — | Bulanan |
| Sales Team (Horeca) | Parameter | — | Bulanan |
| Sales SPV (Horeca) | Parameter | — | Bulanan |
| Delivery Team | Volume Tier | Pick Up / Engkel / Double | Bulanan |

## Aturan Perhitungan

### Mode Template (preset cepat)
Pilih di **Skema Insentif** → Template:

- *Parameter Mandiri* (default dokumen): insentif = Σ nominal per parameter pada tier pencapaian masing-masing parameter
- *Tier Rata-rata Tertimbang / Sederhana / Tertinggi / Terendah*: satu tier agregat, gross = total nominal tier

### Mode Rule Builder (custom per parameter)
**Skema Insentif** → pilih **Rule Builder (custom per parameter)**:

Contoh pola dokumen ASS MT:
```
All Product · IF pencapaian ≥ 70% masuk tier → slice breakdown × pengali
```

Per aturan parameter bisa diatur:
- Parameter (All Product, EC, …)
- Min. pencapaian (%)
- Hanya tier tertentu (opsional, mis. ≥70%; <80%)
- Sumber nominal: slice breakdown / bobot×total / total penuh
- Pengali (×)

Tombol **Sync dari Bobot** mengisi parameter dari halaman Bobot & Nominal.

- Breakdown nominal per parameter = bobot × total nominal tier (pola konsisten di seluruh dokumen)
- **Penalty multi-aturan** per skema: kondisi (overdue % / bad debt hari) + aksi (potongan %, penangguhan, penghapusan) — bisa ditambah lebih dari satu aturan
- Seed default: overdue >0,5% → potong 10% (manager 20%); bad debt >60 hari penangguhan; >90 hari penghapusan
- Pembagian tim (mis. Canvasser 3 org: 55% / 22,5% / 22,5%) dikonfigurasi per skema
- Delivery: tier kartonase + drop point per armada, quality gate OTD ≥ 95% & akurasi ≥ 97%

## Menjalankan

```bash
cd web
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

### Jika muncul "missing required error components, refreshing..."

Pesan ini muncul di **development** saat Hot Reload gagal memuat ulang chunk JavaScript (bukan bug data aplikasi). Penyebab umum:

1. **`npm run build` dijalankan sementara `npm run dev` masih aktif** — cache `.next` bentrok
2. **Browser menyimpan chunk `_next` lama** setelah file di-save
3. **Turbopack HMR** (`--turbo`) lebih rentan pada library client seperti `react-select`

**Perbaikan:**

```bash
# 1. Hentikan dev server (Ctrl+C)
npm run reset
npm run dev          # default: webpack (lebih stabil)
```

Di browser DevTools → Network → centang **Disable cache** (hanya saat develop).

Jangan jalankan `build` dan `dev` bersamaan. Hindari `npm run dev:turbo` kecuali Anda sengaja ingin Turbopack.

### Jika CSS tidak ter-load / tampilan polos / "Memuat data..." stuck

Penyebab umum: **cache `.next` korup** — terjadi jika `npm run build` dijalankan sementara `npm run dev` masih aktif, atau folder `.next` dihapus tanpa restart dev server. Gejala di terminal:

```
GET /_next/static/css/app/layout.css 404
GET /_next/static/chunks/main-app.js 404
```

**Perbaikan (wajib hentikan dev server dulu dengan Ctrl+C):**

```bash
cd web
npm run reset      # bersihkan cache
npm run dev        # jalankan ulang
```

Atau satu perintah:

```bash
npm run dev:fresh
```

Lalu **hard refresh** browser: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows).

**Jangan** jalankan `npm run build` dan `npm run dev` bersamaan — `prebuild` akan memblokir build jika port 3000 masih dipakai dev server. Urutan aman:

1. Ctrl+C (hentikan dev)
2. `npm run build`
3. `npm run start`

### Jika tampilan polos (versi singkat)

**Perbaikan cepat:**

```bash
cd web
# hentikan dev server lama (Ctrl+C), lalu:
npm run dev:clean
```

Lalu hard refresh browser (Cmd+Shift+R).

Untuk preview stabil tanpa HMR, gunakan:

```bash
npm run build && npm run start
```

## Deploy Windows Server + IIS

Lihat panduan lengkap: [`deploy/README.md`](deploy/README.md)

Ringkas:

```powershell
cd web
.\deploy\start-production.ps1
.\deploy\setup-iis.ps1 -IisPhysicalPath "C:\inetpub\lahans-insentif-iis"
```

Atur site IIS → physical path folder di atas → binding domain/port → restart site.

## Data

- Storage key: `lahans-insentif-v7` (key lama akan otomatis di-migrate)
- Gunakan **Reset Data Lokal** di sidebar untuk kembali ke seed default

## Struktur

```
web/src/
├── app/           # Pages (skema, parameter, tier, bobot, pencapaian, pengiriman, ...)
├── components/    # UI components
├── data/seed.ts   # Seed semua 14 sheet Excel
├── data/formula-templates.ts  # Definisi template rumus per skema
├── hooks/         # useAppData hook
├── lib/           # storage + calculator + formula/penalty engine
└── types/         # TypeScript types
```
