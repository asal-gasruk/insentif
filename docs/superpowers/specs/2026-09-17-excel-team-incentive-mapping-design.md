# Excel → Prototype Insentif Tim — Mapping Spec

**Date:** 2026-09-17  
**Source:** `docs/Insentif Team - Data Karyawan SFA.xlsx`  
**Sheets:** `Pembagian Insentif`, `Sales Team SFA`

## Pool rule (confirmed)

Excel menyimpan satu kolom **DRIVER/HELPER** (pool). Prototype memecah ke posisi `driver` / `helper1` / `helper2`.

**Aturan:** untuk ukuran tim N:

| Team size | Salesman | Pool non-salesman |
|-----------|----------|-------------------|
| 3 | 55% | 45% dibagi rata antar anggota non-salesman |
| 2 | 70% | 30% dibagi rata |
| 1 | 100% | 0% |

Berlaku untuk komposisi non-standar (mis. Salesman+Helper+Helper): sisa pool tetap dibagi rata. Tidak ada bobot khusus antar Driver vs Helper di dokumen sumber.

Implementasi: `resolveParameterTeamSplitRatio` di `src/lib/team-utils.ts`.  
Default skema UI tetap `SALES_TEAM_SPLITS` (55 / 22.5 / 22.5 untuk size 3).

## Field mapping — Sales Team SFA

| Excel | Prototype | Aturan |
|-------|-----------|--------|
| NIK Karyawan | `Employee.nik` | Wajib; skip jika kosong / Vacant |
| NAMA | `Employee.name` | Skip `(Vacant)` |
| CABANG | `Branch` via normalisasi nama | Lihat tabel cabang di `sfa-import.ts` |
| JABATAN Salesman / Canvas Motoris / Horeca Executive / … | `position: salesman` | Lead tim |
| JABATAN Driver | `position: driver` | |
| JABATAN Helper | `helper1` lalu `helper2` | Urutan dalam blok Excel |
| Kode (mis. `BDG-SLS-GT-001`) | `Team.id` / `Team.name` | Kode di lead; anggota ikut grup |
| Prefix `*-GT-*` | `roleId: canvasser`, `teamType: GT` | |
| Prefix `*-HRC-*` / Horeca Executive | `sales-horeca`, `Horeca` | |
| Prefix `*-MT-*` / Sales Executive | `sales-mt`, `MT` | |
| — | `workforceMode: "team"` | Anggota Master Tim aktif |
| SPV / SP-* / ASM / FSR / … | Karyawan individu | Tidak masuk `Team.members` |

Sheet **Sales Team** (tanpa NIK) diabaikan; SFA adalah sumber of truth.

## Artefak data

| File | Peran |
|------|--------|
| `src/data/sfa-excel.json` | Dump ter-normalisasi dari Excel (regenerate via script) |
| `src/lib/sfa-import.ts` | Mapping JSON → `Branch` / `Employee` / `Team` |
| `scripts/generate-sfa-excel-json.py` | Regenerasi JSON dari xlsx |
| `scripts/verify-sfa-mapping.mjs` | Validasi split vs contoh sheet Pembagian Insentif |

## Alur hitung

1. Gross insentif tim (nominal × tier, `teamSize = members.length`)
2. Split per anggota memakai pool rule di atas
3. Achievement diinput per `teamId` (kode salesman)

Contoh Excel: `BDG-SLS-GT-001` gross 600.000 → Sales 330.000 + Driver/Helper 270.000 (135.000 masing-masing jika 2 orang non-salesman).

## Scope fase 1

- Import tim GT / MT / Horeca (+ Canvas Motoris solo)
- Individu SPV-like untuk manpower
- Delivery Man / Helper Delivery / dll. belum jadi Master Tim (fase berikutnya)
