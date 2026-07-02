import type { FormulaAggregation } from "@/types";

export interface AggregationGuide {
  id: FormulaAggregation;
  title: string;
  /** Sesuai dokumen Plan 2026? */
  docDefault: boolean;
  docReference: string;
  summary: string;
  formula: string;
  example: string;
  whenToUse: string;
}

export const DOC_INDEPENDENT_PARAMS =
  "Masing-masing parameter Insentif berdiri sendiri-sendiri — satu parameter tidak terkait dengan parameter lainnya. (Sheet Skema Insentif GT / MT / Horeca)";

export const FORMULA_AGGREGATION_GUIDE: AggregationGuide[] = [
  {
    id: "sumPerParam",
    title: "Jumlahkan per Parameter (mandiri)",
    docDefault: true,
    docReference:
      "Semua lampiran GT, MT, Horeca, ASS/ASM/RSM/NSM — catatan umum di Excel",
    summary:
      "Setiap parameter dihitung sendiri: tier pencapaian per parameter, nominal dari baris tier yang sesuai, lalu dijumlahkan.",
    formula:
      "Gross = Σ [nominal paramᵢ pada tier pencapaian paramᵢ] × pengali",
    example:
      "ASS MT · All Product 75% (tier ≥70%;<80%) → slice All Product + EC 92% (tier ≥90%;<100%) → slice EC. Total = keduanya.",
    whenToUse:
      "Gunakan ini untuk semua skema yang mengikuti dokumen Plan 2026 (Canvasser, TO, Mix, ASS, ASM, RSM, NSM, Sales MT/Horeca, ASS MT).",
  },
  {
    id: "weightedAvgTier",
    title: "Satu Tier — Rata-rata Tertimbang",
    docDefault: false,
    docReference: "Tidak ada di dokumen — mode alternatif / simulasi",
    summary:
      "Satu tier ditentukan dari rata-rata tertimbang pencapaian (menggunakan bobot di Bobot & Nominal), lalu gross diambil dari total nominal tier tersebut.",
    formula:
      "Tier = f(Σ pencapaianᵢ × bobotᵢ) → Gross = total nominal tier × pengali agregat",
    example:
      "Bobot All Product 50%, EC 20%, NOO 15%. Rata-rata tertimbang 82% → tier ≥80%;<90% → gross = total nominal tier itu.",
    whenToUse:
      "Hanya jika kebijakan internal mengikat semua parameter ke satu tier agregat tertimbang. Bukan pola default dokumen.",
  },
  {
    id: "simpleAvgTier",
    title: "Satu Tier — Rata-rata Sederhana",
    docDefault: false,
    docReference: "Tidak ada di dokumen — mode alternatif",
    summary:
      "Satu tier dari rata-rata sederhana semua parameter aktif, tanpa bobot.",
    formula: "Tier = f(Σ pencapaianᵢ / n) → Gross = total nominal tier",
    example:
      "Pencapaian All Product 90%, EC 70%, NOO 80% → rata-rata 80% → tier ≥80%;<90%.",
    whenToUse: "Simulasi skema khusus; tidak mengikuti catatan mandiri per parameter di Excel.",
  },
  {
    id: "maxTier",
    title: "Satu Tier — Pencapaian Tertinggi",
    docDefault: false,
    docReference: "Tidak ada di dokumen — mode alternatif",
    summary:
      "Tier ditentukan dari parameter dengan pencapaian tertinggi; gross = total nominal tier tersebut.",
    formula: "Tier = f(max pencapaianᵢ) → Gross = total nominal tier",
    example:
      "All Product 110%, EC 75% → pakai tier dari 110% (≥110%) untuk seluruh gross.",
    whenToUse:
      "Kebijakan 'best performer' — jarang dipakai di insentif reguler dokumen.",
  },
  {
    id: "minTier",
    title: "Satu Tier — Pencapaian Terendah",
    docDefault: false,
    docReference: "Tidak ada di dokumen — mode alternatif",
    summary:
      "Tier ditentukan dari parameter dengan pencapaian terendah; gross = total nominal tier tersebut.",
    formula: "Tier = f(min pencapaianᵢ) → Gross = total nominal tier",
    example:
      "All Product 100%, EC 72% → pakai tier dari 72% (≥70%;<80%) — lebih ketat.",
    whenToUse:
      "Kebijakan 'weakest link' — tidak sesuai catatan mandiri di dokumen.",
  },
];

export function getAggregationGuide(
  id: FormulaAggregation,
): AggregationGuide {
  return (
    FORMULA_AGGREGATION_GUIDE.find((g) => g.id === id) ??
    FORMULA_AGGREGATION_GUIDE[0]
  );
}

export const SCHEME_SETUP_STEPS = [
  {
    step: 1,
    menu: "Master Parameter",
    path: "/parameter",
    action: "Tambah/definisikan parameter (All Product, EC, NOO, …) sesuai sheet Excel.",
  },
  {
    step: 2,
    menu: "Master Tier",
    path: "/tier",
    action:
      "Atur tier pencapaian (≥70%;<80%, ≥80%;<90%, …). Default sudah sesuai dokumen.",
  },
  {
    step: 3,
    menu: "Skema Insentif",
    path: "/skema",
    action:
      "Tambah/edit skema: role, segment, periode, rumus (Template atau Rule Builder), penalty.",
  },
  {
    step: 4,
    menu: "Bobot & Nominal",
    path: "/bobot",
    action:
      "Isi bobot per segment + nominal per tier/ukuran tim. Breakdown = bobot × total.",
  },
  {
    step: 5,
    menu: "Karyawan",
    path: "/karyawan",
    action: "Daftarkan karyawan: role, cabang, posisi, ukuran tim.",
  },
  {
    step: 6,
    menu: "Pencapaian",
    path: "/pencapaian",
    action: "Input % pencapaian per parameter, overdue, bad debt.",
  },
  {
    step: 7,
    menu: "Perhitungan",
    path: "/perhitungan",
    action: "Lihat hasil kalkulasi insentif.",
  },
] as const;

export const RULE_BUILDER_INSERT_GUIDE = [
  "Buka Skema Insentif → Edit skema (mis. ASS MT) atau + Tambah Skema.",
  "Pilih Rule Builder (custom per parameter).",
  "Agregasi: pilih Jumlahkan per Parameter (mandiri) — sesuai catatan dokumen Excel.",
  "Klik Sync dari Bobot (setelah bobot diisi di halaman Bobot & Nominal).",
  "Per parameter: pilih Tier Pencapaian → Min. % otomatis mengikuti tier.",
  "Sumber Nominal: Slice breakdown (default, sama dengan bobot × total tier di Excel).",
  "Pengali: 1 (kecuali ada faktor khusus di kebijakan).",
  "Atur Penalty multi-aturan (overdue 10%/20%, bad debt 60/90 hari sesuai role).",
  "Simpan → uji di Pencapaian + Perhitungan.",
];
