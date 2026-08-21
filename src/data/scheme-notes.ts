const INDEPENDENT_PARAMS =
  "Masing-masing parameter Insentif berdiri sendiri-sendiri — satu parameter tidak terkait dengan parameter lainnya.";

const NB_FOCUS_NOTE =
  "Focus Product di NB (Cabang Baru) sama dengan Anchor Product.";

export const SCHEME_NOTES: Record<string, string> = {
  "sch-canvasser": [
    "Lampiran 02 — Canvass Team (GT)",
    INDEPENDENT_PARAMS,
    "Pencapaian diinput per Master Tim (bukan per individu).",
    "Pembagian tim: 3 orang (55% / 22,5% / 22,5%) atau 2 orang (70% / 30%).",
    NB_FOCUS_NOTE,
  ].join("\n\n"),

  "sch-to": [
    "Lampiran 03 — Taking Order / Sales Exclusive (GT)",
    INDEPENDENT_PARAMS,
    "Insentif untuk 1 salesman per tim.",
    NB_FOCUS_NOTE,
  ].join("\n\n"),

  "sch-mix": [
    "Lampiran 04 — SLD Mix (Salesman Distributor)",
    INDEPENDENT_PARAMS,
    NB_FOCUS_NOTE,
  ].join("\n\n"),

  "sch-ass": [
    "Lampiran 05 — Area Sales Supervisor (ASS)",
    INDEPENDENT_PARAMS,
    "Penalty overdue piutang: potongan 10% jika overdue > 0,5%.",
  ].join("\n\n"),

  "sch-asm": [
    "Lampiran 06 — Area Sales Manager (ASM)",
    INDEPENDENT_PARAMS,
    "Segment: Area Jawa vs Luar Pulau.",
    "Penalty overdue piutang: potongan 20% jika overdue > 0,5%.",
  ].join("\n\n"),

  "sch-rsm": [
    "Lampiran 07 — Regional Sales Manager (RSM)",
    INDEPENDENT_PARAMS,
    "Direct Distribution dihitung per bulan. Indirect Distribution dihitung per kuartal.",
    "Penalty overdue piutang: potongan 20%.",
  ].join("\n\n"),

  "sch-nsm": [
    "Lampiran 08 — National Sales Manager (NSM)",
    INDEPENDENT_PARAMS,
    "Seluruh skema dihitung per kuartal (Direct, Indirect, National).",
    "Penalty overdue piutang: potongan 20%.",
  ].join("\n\n"),

  "sch-sales-mt": [
    "Lampiran 10 — Sales Team (MT)",
    INDEPENDENT_PARAMS,
    "Tanpa segment cabang — berlaku untuk seluruh wilayah MT.",
    "Pencapaian diinput per Master Tim (bukan per individu).",
    "Pembagian tim: 3 orang (55% / 22,5% / 22,5%), 2 orang (70% / 30%), atau 1 orang (100%).",
  ].join("\n\n"),

  "sch-spv-mt": [
    "Lampiran 12 — Sales SPV (MT)",
    INDEPENDENT_PARAMS,
    "Di dokumen, tab sheet bernama 'Sales SPV (MT)' — di Lampiran 09 posisi setara disebut KAS MT (Key Account Supervisor MT).",
    "Parameter tambahan: Product Display (PD) dan merchandising compliance.",
  ].join("\n\n"),

  "sch-ass-mt": [
    "Lampiran 12 — ASS MT (Area Sales Supervisor MT)",
    INDEPENDENT_PARAMS,
    "Konfigurasi awal mengikuti tabel 'Skema Insentif ASS MT' & 'Nominal Insentif ASS MT' di sheet — bobot/nominal dapat diubah terpisah dari Sales SPV (MT).",
    "Parameter tambahan: Product Display (PD) dan merchandising compliance.",
  ].join("\n\n"),

  "sch-sales-horeca": [
    "Lampiran 11 — Sales Team (Horeca)",
    INDEPENDENT_PARAMS,
    "Parameter khusus: Sales Contract, Co-Branding, NOO, AO.",
    "Pencapaian diinput per Master Tim (bukan per individu).",
    "Pembagian tim: 3 orang (55% / 22,5% / 22,5%), 2 orang (70% / 30%), atau 1 orang (100%).",
  ].join("\n\n"),

  "sch-spv-horeca": [
    "Lampiran 13 — Sales SPV / ASS Horeca",
    INDEPENDENT_PARAMS,
    "Parameter tambahan: CSI/NPS, Joint Event Activity (JE).",
    "JE: 3x simple event per bulan, 1x middle event per kuartal.",
  ].join("\n\n"),

  "sch-delivery": [
    "Lampiran 14 — Delivery Team",
    "Delivery Team adalah tim pengiriman yang terdiri dari driver dan helper sesuai jenis armada.",
    "Komponen insentif: Kartonase (volume kirim) + Drop Point (jumlah faktur).",
    "Quality Gate: On Time Delivery (OTD) ≥ 95% dan akurasi produk ≥ 97%.",
    "Pembagian: Pick Up driver 100%; Engkel 55/45; Double 40/30/30.",
  ].join("\n\n"),
};
