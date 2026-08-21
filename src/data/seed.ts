import { PARAMETER_NOTES } from "@/data/parameter-notes";
import { SCHEME_NOTES } from "@/data/scheme-notes";
import { SALES_TEAM_SPLITS } from "@/lib/team-utils";
import type {
  AppData,
  IncentiveScheme,
  Parameter,
  PenaltyRule,
  SchemeNominal,
  SchemeWeight,
  VolumeTier,
} from "@/types";

export const STORAGE_KEY = "lahans-insentif-v9";

function param(
  id: string,
  name: string,
  unit: string,
  shortLabel: string,
): Parameter {
  return {
    id,
    name,
    unit,
    shortLabel,
    notes: PARAMETER_NOTES[id],
  };
}

const TIER_IDS = ["t1", "t2", "t3", "t4", "t5"] as const;

function defaultPenalties(reductionPct = 10): PenaltyRule[] {
  return [
    {
      id: "pen-overdue",
      label: "Penalty Overdue Piutang",
      enabled: true,
      condition: { field: "overduePct", operator: "gt", value: 0.5 },
      action: { type: "reducePercent", reductionPct },
    },
    {
      id: "pen-suspend",
      label: "Penangguhan Bad Debt",
      enabled: true,
      condition: { field: "badDebtDays", operator: "gt", value: 60 },
      action: { type: "suspend" },
    },
    {
      id: "pen-void",
      label: "Penghapusan Bad Debt",
      enabled: true,
      condition: { field: "badDebtDays", operator: "gt", value: 90 },
      action: { type: "void" },
    },
  ];
}

const DEFAULT_PENALTIES = defaultPenalties(10);
const MANAGER_PENALTIES = defaultPenalties(20);

const BRANCH_SEGMENTS = [
  { id: "MB", name: "Cabang Menengah (MB)" },
  { id: "SB", name: "Cabang Kecil (SB)" },
  { id: "NB", name: "Cabang Baru (NB)" },
];

const NONE_SEGMENT = [{ id: "ALL", name: "Semua" }];

// ---------------------------------------------------------------------------
// Builder helpers — di dokumen, breakdown nominal = bobot x total nominal
// ---------------------------------------------------------------------------

function weight(
  schemeId: string,
  segmentId: string,
  weights: Record<string, number>,
): SchemeWeight {
  return { id: `w-${schemeId}-${segmentId}`, schemeId, segmentId, weights };
}

function nominals(
  schemeId: string,
  segmentId: string,
  teamSize: number,
  totals: number[],
  weights: Record<string, number>,
): SchemeNominal[] {
  return totals.map((total, i) => ({
    id: `n-${schemeId}-${segmentId}-${teamSize}-${TIER_IDS[i]}`,
    schemeId,
    segmentId,
    teamSize,
    achievementTierId: TIER_IDS[i],
    totalNominal: total,
    breakdown: Object.fromEntries(
      Object.entries(weights).map(([p, w]) => [p, Math.round(total * w)]),
    ),
  }));
}

// ---------------------------------------------------------------------------
// Bobot per skema/segment — diekstrak dari masing-masing lampiran dokumen
// ---------------------------------------------------------------------------

const W = {
  gtMB: { allProduct: 0.5, focusVol: 0.1, focusRO: 0.1, ec: 0.15, iptIpo: 0.15 },
  gtSB: { allProduct: 0.5, focusVol: 0.1, focusRO: 0.1, ec: 0.15, noo: 0.15 },
  gtNB: { allProduct: 0.5, ec: 0.2, noo: 0.2, ao: 0.1 },
  assMB: { allProduct: 0.4, focusVol: 0.1, focusRO: 0.1, ao: 0.2, iptIpo: 0.2 },
  assSB: { allProduct: 0.4, focusVol: 0.1, focusRO: 0.1, noo: 0.2, ao: 0.2 },
  assNB: { allProduct: 0.4, ec: 0.2, noo: 0.2, ao: 0.2 },
  asmJawa: { allProduct: 0.7, ao: 0.3 },
  asmLuar: { allProduct: 0.75, focusVol: 0.15, ao: 0.1 },
  spvMT: { allProduct: 0.6, focusVol: 0.1, ec: 0.1, ao: 0.1, pd: 0.1 },
  salesMT: { allProduct: 0.5, focusVol: 0.1, focusRO: 0.1, ec: 0.1, noo: 0.1, iptIpo: 0.1 },
  salesHoreca: { allProduct: 0.4, contract: 0.1, coBranding: 0.1, noo: 0.2, ao: 0.2 },
  spvHoreca: { allProduct: 0.55, contract: 0.1, coBranding: 0.1, noo: 0.1, ao: 0.1, je: 0.05 },
};

// ---------------------------------------------------------------------------
// Skema — Lampiran 02 s/d 14
// ---------------------------------------------------------------------------

const schemes: IncentiveScheme[] = [
  {
    id: "sch-canvasser",
    roleId: "canvasser",
    name: "Canvass Team (GT)",
    type: "parameter",
    segmentDimension: "branchType",
    segments: BRANCH_SEGMENTS,
    period: "monthly",
    penalties: DEFAULT_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: SALES_TEAM_SPLITS,
    notes: SCHEME_NOTES["sch-canvasser"],
  },
  {
    id: "sch-to",
    roleId: "to",
    name: "Taking Order / Sales Exclusive (GT)",
    type: "parameter",
    segmentDimension: "branchType",
    segments: BRANCH_SEGMENTS,
    period: "monthly",
    penalties: DEFAULT_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: [{ key: "1", split: { salesman: 1 } }],
    notes: SCHEME_NOTES["sch-to"],
  },
  {
    id: "sch-mix",
    roleId: "mix",
    name: "SLD Mix (Salesman Distributor)",
    type: "parameter",
    segmentDimension: "branchType",
    segments: BRANCH_SEGMENTS,
    period: "monthly",
    penalties: DEFAULT_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: [{ key: "1", split: { salesman: 1 } }],
    notes: SCHEME_NOTES["sch-mix"],
  },
  {
    id: "sch-ass",
    roleId: "ass",
    name: "Area Sales Supervisor (ASS)",
    type: "parameter",
    segmentDimension: "branchType",
    segments: BRANCH_SEGMENTS,
    period: "monthly",
    penalties: DEFAULT_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: [{ key: "1", split: { supervisor: 1 } }],
    notes: SCHEME_NOTES["sch-ass"],
  },
  {
    id: "sch-asm",
    roleId: "asm",
    name: "Area Sales Manager (ASM)",
    type: "parameter",
    segmentDimension: "area",
    segments: [
      { id: "JAWA", name: "Area Jawa" },
      { id: "LUAR", name: "Luar Pulau" },
    ],
    period: "monthly",
    penalties: MANAGER_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: [{ key: "1", split: { manager: 1 } }],
    notes: SCHEME_NOTES["sch-asm"],
  },
  {
    id: "sch-rsm",
    roleId: "rsm",
    name: "Regional Sales Manager (RSM)",
    type: "parameter",
    segmentDimension: "distribution",
    segments: [
      { id: "DIRECT", name: "Direct Distribution (per Bulan)" },
      { id: "INDIRECT", name: "Indirect Distribution (per Kuartal)" },
    ],
    period: "monthly",
    penalties: MANAGER_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: [{ key: "1", split: { manager: 1 } }],
    notes: SCHEME_NOTES["sch-rsm"],
  },
  {
    id: "sch-nsm",
    roleId: "nsm",
    name: "National Sales Manager (NSM)",
    type: "parameter",
    segmentDimension: "distribution",
    segments: [
      { id: "DIRECT", name: "Direct Distribution" },
      { id: "INDIRECT", name: "Indirect Distribution" },
      { id: "NATIONAL", name: "National Distribution" },
    ],
    period: "quarterly",
    penalties: MANAGER_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: [{ key: "1", split: { manager: 1 } }],
    notes: SCHEME_NOTES["sch-nsm"],
  },
  {
    id: "sch-sales-mt",
    roleId: "sales-mt",
    name: "Sales Team (MT)",
    type: "parameter",
    segmentDimension: "none",
    segments: NONE_SEGMENT,
    period: "monthly",
    penalties: DEFAULT_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: SALES_TEAM_SPLITS,
    notes: SCHEME_NOTES["sch-sales-mt"],
  },
  {
    id: "sch-spv-mt",
    roleId: "spv-mt",
    name: "Sales SPV (MT)",
    type: "parameter",
    segmentDimension: "none",
    segments: NONE_SEGMENT,
    period: "monthly",
    penalties: DEFAULT_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: [{ key: "1", split: { supervisor: 1 } }],
    notes: SCHEME_NOTES["sch-spv-mt"],
  },
  {
    id: "sch-ass-mt",
    roleId: "ass-mt",
    name: "ASS MT (Area Sales Supervisor MT)",
    type: "parameter",
    segmentDimension: "none",
    segments: NONE_SEGMENT,
    period: "monthly",
    penalties: DEFAULT_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: [{ key: "1", split: { supervisor: 1 } }],
    notes: SCHEME_NOTES["sch-ass-mt"],
  },
  {
    id: "sch-sales-horeca",
    roleId: "sales-horeca",
    name: "Sales Team (Horeca)",
    type: "parameter",
    segmentDimension: "none",
    segments: NONE_SEGMENT,
    period: "monthly",
    penalties: DEFAULT_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: SALES_TEAM_SPLITS,
    notes: SCHEME_NOTES["sch-sales-horeca"],
  },
  {
    id: "sch-spv-horeca",
    roleId: "spv-horeca",
    name: "Sales SPV / ASS Horeca",
    type: "parameter",
    segmentDimension: "none",
    segments: NONE_SEGMENT,
    period: "monthly",
    penalties: DEFAULT_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: [{ key: "1", split: { supervisor: 1 } }],
    notes: SCHEME_NOTES["sch-spv-horeca"],
  },
  {
    id: "sch-delivery",
    roleId: "delivery",
    name: "Delivery Team",
    type: "volumeTier",
    segmentDimension: "vehicle",
    segments: [
      { id: "PICKUP", name: "Pick Up (bak/box)" },
      { id: "ENGKEL", name: "Truk Engkel (4 roda)" },
      { id: "DOUBLE", name: "Truk Double (6 roda)" },
    ],
    period: "monthly",
    penalties: DEFAULT_PENALTIES,
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: [
      { key: "PICKUP", split: { driver: 1 } },
      { key: "ENGKEL", split: { driver: 0.55, helper1: 0.45 } },
      { key: "DOUBLE", split: { driver: 0.4, helper1: 0.3, helper2: 0.3 } },
    ],
    notes: SCHEME_NOTES["sch-delivery"],
  },
];

// ---------------------------------------------------------------------------
// Bobot per skema
// ---------------------------------------------------------------------------

const schemeWeights: SchemeWeight[] = [
  weight("sch-canvasser", "MB", W.gtMB),
  weight("sch-canvasser", "SB", W.gtSB),
  weight("sch-canvasser", "NB", W.gtNB),
  weight("sch-to", "MB", W.gtMB),
  weight("sch-to", "SB", W.gtSB),
  weight("sch-to", "NB", W.gtNB),
  weight("sch-mix", "MB", W.gtMB),
  weight("sch-mix", "SB", W.gtSB),
  weight("sch-mix", "NB", W.gtNB),
  weight("sch-ass", "MB", W.assMB),
  weight("sch-ass", "SB", W.assSB),
  weight("sch-ass", "NB", W.assNB),
  weight("sch-asm", "JAWA", W.asmJawa),
  weight("sch-asm", "LUAR", W.asmLuar),
  weight("sch-rsm", "DIRECT", W.asmJawa),
  weight("sch-rsm", "INDIRECT", W.asmLuar),
  weight("sch-nsm", "DIRECT", W.asmJawa),
  weight("sch-nsm", "INDIRECT", W.asmLuar),
  weight("sch-nsm", "NATIONAL", W.asmJawa),
  weight("sch-sales-mt", "ALL", W.salesMT),
  weight("sch-spv-mt", "ALL", W.spvMT),
  weight("sch-ass-mt", "ALL", W.spvMT),
  weight("sch-sales-horeca", "ALL", W.salesHoreca),
  weight("sch-spv-horeca", "ALL", W.spvHoreca),
];

// ---------------------------------------------------------------------------
// Nominal per tier (total dari dokumen; breakdown = bobot x total)
// ---------------------------------------------------------------------------

const schemeNominals: SchemeNominal[] = [
  // Canvasser — Lampiran 02
  ...nominals("sch-canvasser", "MB", 3, [300000, 600000, 900000, 1200000, 1500000], W.gtMB),
  ...nominals("sch-canvasser", "MB", 2, [225000, 450000, 675000, 900000, 1125000], W.gtMB),
  ...nominals("sch-canvasser", "SB", 3, [300000, 600000, 900000, 1200000, 1500000], W.gtSB),
  ...nominals("sch-canvasser", "SB", 2, [225000, 450000, 675000, 900000, 1125000], W.gtSB),
  ...nominals("sch-canvasser", "NB", 3, [300000, 600000, 900000, 1200000, 1500000], W.gtNB),
  // Taking Order — Lampiran 03
  ...nominals("sch-to", "MB", 1, [165000, 330000, 495000, 660000, 825000], W.gtMB),
  ...nominals("sch-to", "SB", 1, [165000, 330000, 495000, 660000, 825000], W.gtSB),
  ...nominals("sch-to", "NB", 1, [165000, 330000, 495000, 660000, 825000], W.gtNB),
  // SLD Mix — Lampiran 04
  ...nominals("sch-mix", "MB", 1, [75000, 150000, 225000, 300000, 375000], W.gtMB),
  ...nominals("sch-mix", "SB", 1, [67500, 135000, 202500, 270000, 337500], W.gtSB),
  ...nominals("sch-mix", "NB", 1, [62500, 125000, 187500, 250000, 312500], W.gtNB),
  // ASS — Lampiran 05
  ...nominals("sch-ass", "MB", 1, [300000, 540000, 840000, 1200000, 1680000], W.assMB),
  ...nominals("sch-ass", "SB", 1, [300000, 540000, 840000, 1200000, 1680000], W.assSB),
  ...nominals("sch-ass", "NB", 1, [300000, 540000, 840000, 1200000, 1680000], W.assNB),
  // ASM — Lampiran 06
  ...nominals("sch-asm", "JAWA", 1, [375000, 675000, 1050000, 1500000, 2000000], W.asmJawa),
  ...nominals("sch-asm", "LUAR", 1, [375000, 675000, 1050000, 1500000, 2000000], W.asmLuar),
  // RSM — Lampiran 07
  ...nominals("sch-rsm", "DIRECT", 1, [375000, 675000, 1050000, 1500000, 2000000], W.asmJawa),
  ...nominals("sch-rsm", "INDIRECT", 1, [1050000, 1890000, 2940000, 4200000, 5600000], W.asmLuar),
  // NSM — Lampiran 08 (per kuartal)
  ...nominals("sch-nsm", "DIRECT", 1, [1000000, 1800000, 2800000, 4000000, 5300000], W.asmJawa),
  ...nominals("sch-nsm", "INDIRECT", 1, [1000000, 1800000, 2800000, 4000000, 5300000], W.asmLuar),
  ...nominals("sch-nsm", "NATIONAL", 1, [2000000, 3600000, 5600000, 8000000, 10600000], W.asmJawa),
  // Sales Team MT — Lampiran 10
  ...nominals("sch-sales-mt", "ALL", 1, [160000, 325000, 490000, 650000, 810000], W.salesMT),
  // Sales SPV MT — Lampiran 12
  ...nominals("sch-spv-mt", "ALL", 1, [200000, 400000, 700000, 1000000, 1400000], W.spvMT),
  // ASS MT — Lampiran 12 (tabel "Nominal Insentif ASS MT")
  ...nominals("sch-ass-mt", "ALL", 1, [200000, 400000, 700000, 1000000, 1400000], W.spvMT),
  // Sales Team Horeca — Lampiran 11
  ...nominals("sch-sales-horeca", "ALL", 1, [160000, 325000, 490000, 650000, 810000], W.salesHoreca),
  // Sales SPV Horeca — Lampiran 13
  ...nominals("sch-spv-horeca", "ALL", 1, [200000, 400000, 700000, 1000000, 1400000], W.spvHoreca),
];

// ---------------------------------------------------------------------------
// Volume tier Delivery — Lampiran 14
// ---------------------------------------------------------------------------

function vt(
  vehicleType: string,
  component: VolumeTier["component"],
  minQty: number,
  maxQty: number | null,
  nominal: number,
): VolumeTier {
  return {
    id: `vt-${vehicleType}-${component}-${minQty}`,
    schemeId: "sch-delivery",
    vehicleType,
    component,
    minQty,
    maxQty,
    nominal,
  };
}

const volumeTiers: VolumeTier[] = [
  // Kartonase Pick-Up (kapasitas ±150 ctn)
  vt("PICKUP", "cartonnage", 0, 1950, 0),
  vt("PICKUP", "cartonnage", 1951, 2860, 40000),
  vt("PICKUP", "cartonnage", 2861, 3900, 75000),
  vt("PICKUP", "cartonnage", 3901, null, 125000),
  // Kartonase Engkel (kapasitas ±400 ctn)
  vt("ENGKEL", "cartonnage", 0, 2600, 0),
  vt("ENGKEL", "cartonnage", 2601, 6500, 100000),
  vt("ENGKEL", "cartonnage", 6501, 10400, 160000),
  vt("ENGKEL", "cartonnage", 10401, null, 275000),
  // Kartonase Double — mengikuti Engkel (dokumen tidak merinci, armada double memakai tier engkel)
  vt("DOUBLE", "cartonnage", 0, 2600, 0),
  vt("DOUBLE", "cartonnage", 2601, 6500, 100000),
  vt("DOUBLE", "cartonnage", 6501, 10400, 160000),
  vt("DOUBLE", "cartonnage", 10401, null, 275000),
  // Drop Point (semua armada)
  ...["PICKUP", "ENGKEL", "DOUBLE"].flatMap((v) => [
    vt(v, "dropPoint", 0, 130, 0),
    vt(v, "dropPoint", 131, 400, 25000),
    vt(v, "dropPoint", 401, 650, 40000),
    vt(v, "dropPoint", 651, null, 60000),
  ]),
];

// ---------------------------------------------------------------------------
// Seed root
// ---------------------------------------------------------------------------

export const seedData: AppData = {
  branchTypes: [
    { id: "TB", name: "Cabang Utama", nameEn: "Top Branch" },
    { id: "LB", name: "Cabang Besar", nameEn: "Large Branch" },
    { id: "MB", name: "Cabang Menengah", nameEn: "Medium Branch" },
    { id: "SB", name: "Cabang Kecil", nameEn: "Small Branch" },
    { id: "NB", name: "Cabang Baru", nameEn: "New Branch" },
  ],
  roles: [
    { id: "canvasser", name: "Canvass Team", sheet: "Canvasser", subjectPolicy: "optional" },
    { id: "to", name: "Taking Order (TO)", sheet: "TO", subjectPolicy: "individu" },
    { id: "mix", name: "SLD Mix", sheet: "Mix", subjectPolicy: "individu" },
    { id: "ass", name: "Area Sales Supervisor (ASS)", sheet: "ASS", subjectPolicy: "individu" },
    { id: "asm", name: "Area Sales Manager (ASM)", sheet: "ASM", subjectPolicy: "individu" },
    { id: "rsm", name: "Regional Sales Manager (RSM)", sheet: "RSM", subjectPolicy: "individu" },
    { id: "nsm", name: "National Sales Manager (NSM)", sheet: "NSM", subjectPolicy: "individu" },
    { id: "spv-mt", name: "Sales SPV (MT)", sheet: "Sales SPV (MT)", subjectPolicy: "individu" },
    { id: "ass-mt", name: "ASS MT (Area Sales Supervisor MT)", sheet: "Sales SPV (MT)", subjectPolicy: "individu" },
    { id: "sales-mt", name: "Sales Team (MT)", sheet: "Sales Team (MT)", subjectPolicy: "optional" },
    { id: "sales-horeca", name: "Sales Team (Horeca)", sheet: "Sales Team (Horeca)", subjectPolicy: "optional" },
    { id: "spv-horeca", name: "Sales SPV (Horeca)", sheet: "Sales SPV (Horeca)", subjectPolicy: "individu" },
    { id: "delivery", name: "Delivery Team", sheet: "Delivery Team", subjectPolicy: "optional" },
  ],
  parameters: [
    param("allProduct", "Sales Value - All Product", "Rp", "All Prod"),
    param("fmAnchor", "Sales Value - Fast Moving & Anchor Prd", "Rp", "FM/Anchor"),
    param("focusVol", "Sales Volume (Ctn) - Focus Product", "Ctn", "Focus Vol"),
    param("focusRO", "# RO (Focus) - Focus Product", "Outlet", "Focus RO"),
    param("sc", "Sales Call (SC)", "#", "SC"),
    param("ec", "Effective Call (EC)", "#", "EC"),
    param("noo", "New Opened Outlet (NOO)", "#", "NOO"),
    param("ro", "Registered Outlet (RO)", "#", "RO"),
    param("ao", "Active Outlet (AO)", "#", "AO"),
    param("iptIpo", "Item per Outlet (IPO)", "SKU", "IPO"),
    param("pd", "Product Display (PD)", "#", "PD"),
    param("pc", "Merchandising & Plano Compliance (PC)", "#", "PC"),
    param("contract", "Sales Contract (6-12 bulan)", "#", "Contract"),
    param("coBranding", "Co-Branding (min 3 bulan)", "#", "Co-Brand"),
    param("sp", "Sales Point (SP)", "#", "SP"),
    param("noa", "New Open Area (NOA)", "#", "NOA"),
    param("nps", "Customer Satisfaction (CSI / NPS)", "%", "CSI/NPS"),
    param("je", "Joint Event Activity (JE)", "#", "JE"),
  ],
  achievementTiers: [
    { id: "t1", label: "≥ 70% ; < 80%", minPct: 70, maxPct: 80 },
    { id: "t2", label: "≥ 80% ; < 90%", minPct: 80, maxPct: 90 },
    { id: "t3", label: "≥ 90% ; < 100%", minPct: 90, maxPct: 100 },
    { id: "t4", label: "≥ 100% ; < 110%", minPct: 100, maxPct: 110 },
    { id: "t5", label: "≥ 110%", minPct: 110, maxPct: null },
  ],
  branches: [
    { id: "br-mb-1", name: "Bandung", branchType: "MB" },
    { id: "br-mb-2", name: "Garut", branchType: "MB" },
    { id: "br-sb-1", name: "Tasikmalaya (Ciamis)", branchType: "SB" },
    { id: "br-sb-2", name: "Subang (Purwasuka)", branchType: "SB" },
    { id: "br-sb-3", name: "Tegal (Bregas Kalang)", branchType: "SB" },
    { id: "br-sb-4", name: "Wangon (Barlingmascakeb)", branchType: "SB" },
    { id: "br-sb-5", name: "Wonosobo (Purwomannggung / Kedu Raya)", branchType: "SB" },
    { id: "br-nb-1", name: "Tangerang", branchType: "NB" },
    { id: "br-nb-2", name: "Sukabumi", branchType: "NB" },
    { id: "br-nb-3", name: "Solo", branchType: "NB" },
    { id: "br-nb-4", name: "Semarang (Kedungsepur)", branchType: "NB" },
    { id: "br-nb-5", name: "Banyuwangi", branchType: "NB" },
    { id: "br-nb-6", name: "Jember", branchType: "NB" },
    { id: "br-nb-7", name: "Jombang (Joker)", branchType: "NB" },
    { id: "br-nb-8", name: "Probolinggo (Paspro)", branchType: "NB" },
    { id: "br-nb-9", name: "Sidoarjo (Gerbangsusi)", branchType: "NB" },
    { id: "br-nb-10", name: "Malang", branchType: "NB" },
    { id: "br-nb-11", name: "Cirebon (Ciayumajakuning)", branchType: "NB" },
    { id: "br-nb-12", name: "Purwakarta", branchType: "NB" },
    { id: "br-nb-13", name: "Jogja", branchType: "NB" },
    { id: "br-nb-14", name: "Kudus (wanarakuti banglor)", branchType: "NB" },
    { id: "br-nb-15", name: "Babat (Latubo)", branchType: "NB" },
    { id: "br-nb-16", name: "Madiun (Pawitandirogo)", branchType: "NB" },
    { id: "br-nb-17", name: "Madura (Pasamsu)", branchType: "NB" },
  ],
  schemes,
  schemeWeights,
  schemeNominals,
  volumeTiers,
  employees: [
    {
      id: "emp-1",
      name: "Budi Santoso",
      nik: "LMN-001",
      roleId: "canvasser",
      branchId: "br-mb-1",
      position: "salesman",
      teamSize: 3,
      workforceMode: "team",
      active: true,
    },
    {
      id: "emp-2",
      name: "Agus Wijaya",
      nik: "LMN-002",
      roleId: "canvasser",
      branchId: "br-mb-1",
      position: "driver",
      teamSize: 3,
      workforceMode: "team",
      active: true,
    },
    {
      id: "emp-10",
      name: "Siti Aminah",
      nik: "LMN-010",
      roleId: "canvasser",
      branchId: "br-mb-1",
      position: "helper1",
      teamSize: 3,
      workforceMode: "team",
      active: true,
    },
    {
      id: "emp-11",
      name: "Andi Pratama",
      nik: "MT-001",
      roleId: "sales-mt",
      branchId: "br-mb-1",
      position: "salesman",
      teamSize: 2,
      workforceMode: "team",
      active: true,
    },
    {
      id: "emp-12",
      name: "Bambang Sutrisno",
      nik: "MT-002",
      roleId: "sales-mt",
      branchId: "br-mb-1",
      position: "driver",
      teamSize: 2,
      workforceMode: "team",
      active: true,
    },
    {
      id: "emp-13",
      name: "Maya Sari",
      nik: "HR-001",
      roleId: "sales-horeca",
      branchId: "br-mb-2",
      position: "salesman",
      teamSize: 1,
      workforceMode: "team",
      active: true,
    },
    {
      id: "emp-3",
      name: "Dewi Lestari",
      nik: "LMN-003",
      roleId: "to",
      branchId: "br-sb-1",
      position: "salesman",
      teamSize: 1,
      workforceMode: "individu",
      active: true,
    },
    {
      id: "emp-4",
      name: "Rina Marlina",
      nik: "LMN-004",
      roleId: "spv-mt",
      branchId: "br-mb-1",
      position: "supervisor",
      teamSize: 1,
      workforceMode: "individu",
      active: true,
    },
    {
      id: "emp-5",
      name: "Hendra Gunawan",
      nik: "LMN-005",
      roleId: "asm",
      branchId: "br-mb-1",
      position: "manager",
      teamSize: 1,
      workforceMode: "individu",
      active: true,
    },
    {
      id: "emp-6",
      name: "Roni Saputra",
      nik: "DT-001",
      roleId: "delivery",
      branchId: "br-mb-1",
      position: "driver",
      teamSize: 2,
      vehicleType: "ENGKEL",
      workforceMode: "team",
      active: true,
    },
    {
      id: "emp-7",
      name: "Rahman Hakim",
      nik: "DT-004",
      roleId: "delivery",
      branchId: "br-mb-1",
      position: "driver",
      teamSize: 1,
      vehicleType: "PICKUP",
      workforceMode: "individu",
      active: true,
    },
    {
      id: "emp-8",
      name: "Joko Prasetyo",
      nik: "DT-002",
      roleId: "delivery",
      branchId: "br-mb-2",
      position: "driver",
      teamSize: 3,
      vehicleType: "DOUBLE",
      workforceMode: "individu",
      active: true,
    },
    {
      id: "emp-9",
      name: "Slamet Riyadi",
      nik: "DT-003",
      roleId: "delivery",
      branchId: "br-mb-1",
      position: "helper1",
      teamSize: 2,
      vehicleType: "ENGKEL",
      workforceMode: "team",
      active: true,
    },
  ],
  teams: [
    {
      id: "team-gt-1",
      name: "Canvass Bandung A",
      teamType: "GT",
      roleId: "canvasser",
      branchId: "br-mb-1",
      members: [
        { employeeId: "emp-1", position: "salesman" },
        { employeeId: "emp-2", position: "driver" },
        { employeeId: "emp-10", position: "helper1" },
      ],
      active: true,
    },
    {
      id: "team-mt-1",
      name: "Sales MT Bandung",
      teamType: "MT",
      roleId: "sales-mt",
      branchId: "br-mb-1",
      members: [
        { employeeId: "emp-11", position: "salesman" },
        { employeeId: "emp-12", position: "driver" },
      ],
      active: true,
    },
    {
      id: "team-horeca-1",
      name: "Horeca Garut",
      teamType: "Horeca",
      roleId: "sales-horeca",
      branchId: "br-mb-2",
      members: [{ employeeId: "emp-13", position: "salesman" }],
      active: true,
    },
    {
      id: "team-dt-1",
      name: "Delivery Bandung Engkel",
      teamType: "Delivery",
      roleId: "delivery",
      branchId: "br-mb-1",
      members: [
        { employeeId: "emp-6", position: "driver" },
        { employeeId: "emp-9", position: "helper1" },
      ],
      active: true,
    },
  ],
  // Data transaksi sengaja kosong — isi via halaman Pencapaian/Pengiriman
  // atau Import Bulk agar hasil perhitungan mudah ditelusuri.
  achievementRecords: [],
  deliveryRecords: [],
};
