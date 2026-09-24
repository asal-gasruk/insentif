# Parameter Target — Design Spec

**Date:** 2026-09-24  
**Source Excel:** `docs/Pencapaian Agustus 2026 - Rev-2.xlsx`  
**Related:** Master Parameter (`/parameter`), Master Tim, Pencapaian (fase berikutnya: Actual)

## Goal

Simpan **TARGET** per subjek × parameter × periode, selaras pola Excel (`ACTUAL / TARGET → %`).  
Fase 1: **hanya TARGET** (CRUD + import dari Excel). Actual tetap di `/pencapaian` nanti.

## Non-goals (fase 1)

- Mengisi / menghitung Actual
- Mengubah formula kalkulasi insentif (masih pakai `%` di `AchievementRecord.achievements`)
- Target ASM by AREA
- Loading & Drop Point (bukan skema % target)
- Join Event Activity (sheet kosong di Excel)

## Excel findings (grain)

| Sheet | Key | Param mapping (prototype) |
|-------|-----|---------------------------|
| Pencapaian Sales Value | team code (`BDG-SLS-GT-001`) | `allProduct` |
| Pencapaian Product Focus | team code | `focusVol` + `focusRO` (dua target) |
| Pencapaian Effective Call | team code | `ec` |
| Pencapaian New Open Outlet | team code | `noo` |
| Pencapaian Active Outlet | team code | `ao` |
| Pencapaian Item per Outlet | team code | `iptIpo` |
| Product Display / Contract / Co-Branding | team code | `pd` / `contract` / `coBranding` (sedikit terisi) |
| Pencapaian ASM | AREA | **out of scope** fase 1 |
| Loading & Drop Point | — | **out of scope** (volumeTier) |

Pola baris salesman: `NAMA CABANG | ID | SALESMAN | ACTUAL | TARGET | PENCAPAIAN (%) | …`

## Data model

### Entity baru: `ParameterTarget`

```ts
interface ParameterTarget {
  id: string;
  /** Mode Master Tim (utama fase 1) */
  teamId?: string;
  /** Mode individu (siap dipakai SPV/ASM nanti) */
  employeeId?: string;
  paramId: string;
  /** YYYY-MM atau YYYY-Qn */
  period: string;
  /** Nilai target absolut (bukan %) — unit mengikuti Parameter.unit */
  target: number;
  notes?: string;
}
```

**Constraints**

- Wajib tepat satu subjek: `teamId` **xor** `employeeId`
- Unique natural key: `(teamId|employeeId, paramId, period)`
- `paramId` harus ada di `parameters`
- `teamId` / `employeeId` harus ada di master terkait

### AppData

- Tambah `parameterTargets: ParameterTarget[]`
- Masukkan ke `CollectionKey` (CRUD via `useAppData`)
- Bump `STORAGE_KEY` (mis. `v13`) agar localStorage refresh

### Parameter master

Tidak diubah isinya (tetap nama/unit/notes). Target **bukan** field di `Parameter`.

## UI

### Navigasi

Tambah item di grup **1 · Master Data**:

- `/target` → **Target Parameter**

Letak dekat Master Parameter karena domain-nya parameter, bukan transaksi pencapaian.

### Halaman `/target`

1. **Filter:** periode, parameter, cabang (opsional), mode Tim / Individu  
2. **Tabel:** subjek (kode tim / NIK), parameter, target, unit, aksi  
3. **Form modal:** pilih Tim (atau karyawan), Parameter, Periode, nilai Target  
4. **Import:** tombol “Import dari Excel Agustus” (atau upload file yang sama) — fase 1 cukup seed/script regenerate dari path docs fixed, plus UI import CSV sederhana opsional

Tampilan default: mode **Tim**, periode `2026-08`.

### `/parameter`

Tidak wajib diubah. Opsional fase 1b: link “Kelola target →” per baris parameter ke `/target?paramId=…`.

## Import pipeline

Mirip SFA:

| Artefak | Peran |
|---------|--------|
| `scripts/generate-parameter-targets.py` | Parse sheet salesman → JSON |
| `src/data/parameter-targets-excel.json` | Dump TARGET (tanpa ACTUAL) |
| `src/lib/parameter-target-import.ts` | JSON → `ParameterTarget[]` (resolve `teamId` via kode tim `sfa-team-{code}`) |
| Seed | Merge ke `SEED_DATA.parameterTargets` |

**Resolve tim:** Excel `ID` = `Team.name` prefix / `Team.id` = `sfa-team-{code}`. Skip jika tim belum ada di seed.

**Periode default import:** `2026-08` (dari nama file).

**Param map:**

```
Sales Value          → allProduct
Product Focus VOL    → focusVol
Product Focus RO     → focusRO
Effective Call       → ec
New Open Outlet      → noo
Active Outlet        → ao
Item per Outlet      → iptIpo
Product Display      → pd
Sales Contract       → contract
Co-Branding          → coBranding
```

Skip baris tanpa TARGET numerik / ID tidak cocok pola kode tim.

## Integrasi nanti (dokumentasikan saja, tidak dikode fase 1)

Di `/pencapaian`, saat Actual diisi:

```
pct = target > 0 ? (actual / target) * 100 : 0
→ AchievementRecord.achievements[paramId] = pct
```

Bisa lookup `parameterTargets` by `(teamId, paramId, period)`.

## Verification

- Script/assert: jumlah target Sales Value ≥ 60; ada sample `BDG-SLS-GT-001` · `allProduct` · `578500000`
- `tsc --noEmit`
- Manual: buka `/target`, filter periode 2026-08, lihat tim Bandung

## Out of scope reminder

Delivery, ASM-by-area, Actual UI, auto-% di kalkulator — fase berikutnya setelah TARGET stabil.
