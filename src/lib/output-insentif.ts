import sfaExcel from "@/data/sfa-excel.json";
import { calculateTeamParameterIncentive } from "@/lib/calculator";
import { evaluatePenalties } from "@/lib/penalty-engine";
import { normalizeImportPeriod } from "@/lib/import-achievement";
import type {
  AchievementRecord,
  AppData,
  IncentiveResult,
  IncentiveScheme,
  Team,
} from "@/types";

/**
 * Output Insentif — tabel kolom merah P:AV sheet "Rekap Insentif Sales Copy".
 * Satu baris per tim sales; subtotal per cabang dan area.
 */

/** Kunci kolom pencapaian / insentif sesuai urutan di Excel. */
export const OUTPUT_PCT_KEYS = [
  "sv",
  "pfVol",
  "pfRo",
  "ec",
  "noo",
  "ao",
  "ipo",
  "pd",
  "contract",
  "cob",
  "je",
] as const;
export type PctKey = (typeof OUTPUT_PCT_KEYS)[number];

export const OUTPUT_INS_KEYS = [
  "sv",
  "pf",
  "ec",
  "noo",
  "ao",
  "ipo",
  "pd",
  "contract",
  "cob",
  "je",
] as const;
export type InsKey = (typeof OUTPUT_INS_KEYS)[number];

/** paramId aplikasi untuk tiap kolom pencapaian */
export const PCT_PARAM: Record<PctKey, string> = {
  sv: "allProduct",
  pfVol: "focusVol",
  pfRo: "focusRO",
  ec: "ec",
  noo: "noo",
  ao: "ao",
  ipo: "iptIpo",
  pd: "pd",
  contract: "contract",
  cob: "coBranding",
  je: "je",
};

/** paramId yang dijumlah ke tiap kolom insentif */
export const INS_PARAMS: Record<InsKey, string[]> = {
  sv: ["allProduct"],
  pf: ["focusVol", "focusRO"],
  ec: ["ec"],
  noo: ["noo"],
  ao: ["ao"],
  ipo: ["iptIpo"],
  pd: ["pd"],
  contract: ["contract"],
  cob: ["coBranding"],
  je: ["je"],
};

export interface OutputAmounts {
  ins: Record<InsKey, number>;
  total: number;
  overduePenalty: number;
  badDebtPenalty: number;
  diterima: number;
  salesman: number;
  driverHelper: number;
}

export interface OutputRow extends OutputAmounts {
  kind: "team";
  teamId: string;
  area: string;
  cabang: string;
  code: string;
  salesmanName: string;
  typeSales: string;
  /** % pencapaian (100 = 100%) per kolom; null jika tidak ada di record */
  pct: Record<PctKey, number | null>;
  overduePct: number;
  badDebtDays: number;
  /** actual (= pct × target) dan target per kolom — untuk agregat baris total */
  actual: Record<PctKey, number | null>;
  target: Record<PctKey, number | null>;
}

export interface OutputTotal extends OutputAmounts {
  label: string;
  pct: Record<PctKey, number | null>;
}

export interface OutputCabang {
  cabang: string;
  rows: OutputRow[];
  total: OutputTotal;
}

export interface OutputArea {
  area: string;
  cabangs: OutputCabang[];
  total: OutputTotal;
}

export interface OutputInsentif {
  period: string;
  areas: OutputArea[];
  grand: OutputTotal;
  rowCount: number;
}

const emptyIns = (): Record<InsKey, number> =>
  Object.fromEntries(OUTPUT_INS_KEYS.map((k) => [k, 0])) as Record<
    InsKey,
    number
  >;

const emptyPct = (): Record<PctKey, number | null> =>
  Object.fromEntries(OUTPUT_PCT_KEYS.map((k) => [k, null])) as Record<
    PctKey,
    number | null
  >;

/** Kode tim tampilan: `sfa-team-BDG-SLS-GT-001` → `BDG-SLS-GT-001`. */
export function teamCode(team: Team): string {
  return team.id.startsWith("sfa-team-")
    ? team.id.slice("sfa-team-".length)
    : team.name;
}

/** Label TYPE SALES: field Team.typeSales, jika kosong "N Orang" (GT) atau tipe tim. */
export function teamTypeSales(team: Team): string {
  if (team.typeSales?.trim()) return team.typeSales.trim();
  return team.teamType === "GT"
    ? `${team.members.length} Orang`
    : team.teamType;
}

/** Area & cabang tampilan (huruf besar seperti Excel) dari dump SFA; fallback nama cabang master. */
export function areaCabangOf(
  team: Team,
  data: AppData,
): { area: string; cabang: string } {
  const src = sfaExcel.teams.find((t) => `sfa-team-${t.code}` === team.id);
  if (src) return { area: src.area, cabang: src.cabang };
  const branch = data.branches.find((b) => b.id === team.branchId);
  return {
    area: "LAINNYA",
    cabang: (branch?.name ?? team.branchId).toUpperCase(),
  };
}

function sumIns(breakdown: Record<string, number>, paramIds: string[]): number {
  return paramIds.reduce((n, id) => n + (breakdown[id] ?? 0), 0);
}

/** Pengurang overdue dan bad debt (positif) dari aturan penalti skema. */
export function splitPenalty(
  scheme: IncentiveScheme | undefined,
  record: AchievementRecord,
  gross: number,
): { overdue: number; badDebt: number } {
  let overdue = 0;
  let badDebt = 0;
  let fullStop = false;
  for (const rule of scheme?.penalties ?? []) {
    if (evaluatePenalties([rule], record).matchedRules.length === 0) continue;
    if (rule.action.type === "reducePercent") {
      const amount = (gross * (rule.action.reductionPct ?? 0)) / 100;
      if (rule.condition.field === "overduePct") overdue += amount;
      else badDebt += amount;
    } else {
      fullStop = true;
    }
  }
  if (fullStop) return { overdue, badDebt: Math.max(0, gross - overdue) };
  return { overdue, badDebt };
}

function membersAmounts(results: IncentiveResult[]) {
  let salesman = 0;
  let driverHelper = 0;
  for (const r of results) {
    if (r.position === "salesman") salesman += r.finalAmount;
    else driverHelper += r.finalAmount;
  }
  return { salesman, driverHelper, diterima: salesman + driverHelper };
}

function buildRow(
  data: AppData,
  record: AchievementRecord,
  team: Team,
): OutputRow | null {
  const results = calculateTeamParameterIncentive(data, record, team);
  if (results.length === 0) return null;

  const scheme = data.schemes.find((s) => s.id === record.schemeId);
  const gross = results[0].grossAmount;
  const breakdown = results[0].parameterBreakdown;
  const { area, cabang } = areaCabangOf(team, data);
  const lead =
    team.members.find((m) => m.position === "salesman") ?? team.members[0];
  const leadName =
    data.employees.find((e) => e.id === lead?.employeeId)?.name ?? "—";

  const ins = emptyIns();
  for (const k of OUTPUT_INS_KEYS) ins[k] = sumIns(breakdown, INS_PARAMS[k]);

  const pct = emptyPct();
  const actual = emptyPct();
  const target = emptyPct();
  for (const k of OUTPUT_PCT_KEYS) {
    const paramId = PCT_PARAM[k];
    const v = record.achievements[paramId];
    pct[k] = v === undefined ? null : v;
    const t = data.parameterTargets.find(
      (x) =>
        x.teamId === team.id &&
        x.paramId === paramId &&
        x.period === record.period,
    )?.target;
    if (v !== undefined && t !== undefined && t > 0) {
      target[k] = t;
      actual[k] = (v / 100) * t;
    }
  }

  const split = splitPenalty(scheme, record, gross);
  const amounts = membersAmounts(results);

  return {
    kind: "team",
    teamId: team.id,
    area,
    cabang,
    code: teamCode(team),
    salesmanName: leadName,
    typeSales: teamTypeSales(team),
    pct,
    ins,
    total: gross,
    overduePct: record.overduePct,
    overduePenalty: -split.overdue,
    badDebtDays: record.badDebtDays,
    badDebtPenalty: -split.badDebt,
    ...amounts,
    actual,
    target,
  };
}

function aggregate(label: string, rows: OutputRow[]): OutputTotal {
  const ins = emptyIns();
  let total = 0;
  let overduePenalty = 0;
  let badDebtPenalty = 0;
  let diterima = 0;
  let salesman = 0;
  let driverHelper = 0;
  const pct = emptyPct();
  const sumActual = emptyPct();
  const sumTarget = emptyPct();

  for (const r of rows) {
    for (const k of OUTPUT_INS_KEYS) ins[k] += r.ins[k];
    total += r.total;
    overduePenalty += r.overduePenalty;
    badDebtPenalty += r.badDebtPenalty;
    diterima += r.diterima;
    salesman += r.salesman;
    driverHelper += r.driverHelper;
    for (const k of OUTPUT_PCT_KEYS) {
      if (r.actual[k] === null || r.target[k] === null) continue;
      sumActual[k] = (sumActual[k] ?? 0) + (r.actual[k] as number);
      sumTarget[k] = (sumTarget[k] ?? 0) + (r.target[k] as number);
    }
  }
  for (const k of OUTPUT_PCT_KEYS) {
    const t = sumTarget[k];
    pct[k] = t && t > 0 ? ((sumActual[k] as number) / t) * 100 : null;
  }
  return {
    label,
    pct,
    ins,
    total,
    overduePenalty,
    badDebtPenalty,
    diterima,
    salesman,
    driverHelper,
  };
}

/** Urutan area/cabang/tim mengikuti dump SFA (urutan Excel); sisanya di akhir. */
export function outputOrderRanks() {
  const order = (list: string[]) => {
    const seen = new Map<string, number>();
    for (const x of list) if (!seen.has(x)) seen.set(x, seen.size);
    return (x: string) => seen.get(x) ?? 999;
  };
  return {
    areaRank: order(sfaExcel.cabangs.map((c) => c.area)),
    cabangRank: order(sfaExcel.cabangs.map((c) => c.cabang)),
    codeRank: order(sfaExcel.teams.map((t) => t.code)),
  };
}

/** Bangun tabel Output Insentif untuk satu periode (opsional satu area). */
export function buildOutputInsentif(
  data: AppData,
  opts: { period: string; area?: string },
): OutputInsentif {
  const period = normalizeImportPeriod(opts.period);
  const rows: OutputRow[] = [];

  for (const record of data.achievementRecords) {
    if (!record.teamId || record.period !== period) continue;
    const team = data.teams.find((t) => t.id === record.teamId);
    if (!team) continue;
    const row = buildRow(data, record, team);
    if (row && (!opts.area || row.area === opts.area)) rows.push(row);
  }

  const { areaRank, cabangRank, codeRank } = outputOrderRanks();

  const areas = [...new Set(rows.map((r) => r.area))].sort(
    (a, b) => areaRank(a) - areaRank(b),
  );
  const outAreas: OutputArea[] = areas.map((area) => {
    const inArea = rows.filter((r) => r.area === area);
    const cabangs = [...new Set(inArea.map((r) => r.cabang))].sort(
      (a, b) => cabangRank(a) - cabangRank(b),
    );
    return {
      area,
      cabangs: cabangs.map((cabang) => {
        const list = inArea
          .filter((r) => r.cabang === cabang)
          .sort((a, b) => codeRank(a.code) - codeRank(b.code));
        return {
          cabang,
          rows: list,
          total: aggregate(`TOTAL CABANG ${cabang}`, list),
        };
      }),
      total: aggregate(`TOTAL AREA ${area}`, inArea),
    };
  });

  return {
    period,
    areas: outAreas,
    grand: aggregate("TOTAL KESELURUHAN", rows),
    rowCount: rows.length,
  };
}

/** Periode yang punya pencapaian tim (untuk pilihan di UI). */
export function outputPeriods(data: AppData): string[] {
  return [
    ...new Set(
      data.achievementRecords.filter((r) => r.teamId).map((r) => r.period),
    ),
  ].sort();
}
